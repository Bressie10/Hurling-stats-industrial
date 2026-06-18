import Stripe from 'https://esm.sh/stripe@22.2.1?target=deno&no-check'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getCustomerId,
  getInvoiceSubscriptionId,
  getPlanByPriceId,
  getSeatLimit,
  getSubscriptionPeriodEnd,
  getSubscriptionPriceId,
  STRIPE_API_VERSION,
} from '../_shared/billing.ts'

function getMetadataUserId(object: { metadata?: Record<string, string> | null }): string | null {
  return object.metadata?.user_id ?? object.metadata?.supabase_user_id ?? null
}

function getJsonHeaders() {
  return { 'Content-Type': 'application/json' }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: STRIPE_API_VERSION,
  })
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  async function authUserExists(userId: string) {
    const { data, error } = await supabase.auth.admin.getUserById(userId)
    if (error) {
      const status = (error as { status?: number }).status
      if (status === 404 || /not found/i.test(error.message)) return false
      throw new Error(`Auth user lookup failed: ${error.message}`)
    }
    return Boolean(data?.user)
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    )
  } catch (e) {
    console.error('Webhook signature verification failed:', e.message)
    return new Response(`Webhook error: ${e.message}`, { status: 400 })
  }

  async function syncSubscription(
    stripeSub: Stripe.Subscription,
    options: {
      userId?: string | null
      customerId?: string | null
      status?: string | null
    } = {},
  ) {
    const priceId = getSubscriptionPriceId(stripeSub)
    if (!priceId) throw new Error(`Subscription ${stripeSub.id} has no price`)

    const plan = getPlanByPriceId()[priceId]
    if (!plan) throw new Error(`Subscription ${stripeSub.id} uses unknown price ${priceId}`)

    const row = {
      plan,
      status: options.status ?? stripeSub.status,
      seat_limit: getSeatLimit(plan),
      current_period_end: getSubscriptionPeriodEnd(stripeSub),
      cancel_at_period_end: stripeSub.cancel_at_period_end ?? false,
      stripe_customer_id: options.customerId ?? getCustomerId(stripeSub.customer),
      stripe_subscription_id: stripeSub.id,
    }

    const userId = options.userId ?? getMetadataUserId(stripeSub)
    if (userId) {
      if (!(await authUserExists(userId))) {
        console.warn(`Skipping subscription ${stripeSub.id} sync for deleted auth user ${userId}`)
        return
      }
      const { error } = await supabase
        .from('subscriptions')
        .upsert({ user_id: userId, ...row }, { onConflict: 'user_id' })
      if (error) throw new Error(`DB upsert failed: ${error.message}`)
      return
    }

    const { error } = await supabase
      .from('subscriptions')
      .update(row)
      .eq('stripe_subscription_id', stripeSub.id)
    if (error) throw new Error(`DB update failed: ${error.message}`)
  }

  try {
    // ── checkout.session.completed ──────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.client_reference_id ?? getMetadataUserId(session)
      if (!userId) throw new Error('No client_reference_id on session')
      if (!session.subscription) throw new Error('No subscription on checkout session')

      const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string)
      await syncSubscription(stripeSub, {
        userId,
        customerId: getCustomerId(session.customer),
      })

      // ── customer.subscription.created / updated ────────────────────────
    } else if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      const stripeSub = event.data.object as Stripe.Subscription
      await syncSubscription(stripeSub)

      // ── customer.subscription.deleted ───────────────────────────────────
    } else if (event.type === 'customer.subscription.deleted') {
      const stripeSub = event.data.object as Stripe.Subscription

      const cancelledRow = {
        plan: 'free',
        status: 'cancelled',
        seat_limit: 1,
        current_period_end: null,
        cancel_at_period_end: false,
        stripe_customer_id: getCustomerId(stripeSub.customer),
        stripe_subscription_id: stripeSub.id,
      }
      const { data, error } = await supabase
        .from('subscriptions')
        .update(cancelledRow)
        .eq('stripe_subscription_id', stripeSub.id)
        .select('user_id')

      if (error) throw new Error(`DB update failed: ${error.message}`)
      if (!data?.length) {
        const userId = getMetadataUserId(stripeSub)
        if (userId) {
          if (!(await authUserExists(userId))) {
            console.warn(
              `Skipping deleted subscription ${stripeSub.id} fallback upsert for deleted auth user ${userId}`,
            )
            return
          }
          const { error: upsertError } = await supabase
            .from('subscriptions')
            .upsert({ user_id: userId, ...cancelledRow }, { onConflict: 'user_id' })
          if (upsertError) throw new Error(`DB upsert failed: ${upsertError.message}`)
        }
      }

      // ── invoice.payment_succeeded ───────────────────────────────────────
      // Keeps period end fresh on every renewal so Pro access never lapses
    } else if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = getInvoiceSubscriptionId(invoice)
      if (!subscriptionId) {
        return new Response(JSON.stringify({ received: true }), { headers: getJsonHeaders() })
      }

      const stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
      await syncSubscription(stripeSub, {
        status: stripeSub.status === 'past_due' ? 'active' : stripeSub.status,
      })

      // ── invoice.payment_failed ──────────────────────────────────────────
      // Stripe retries automatically; mark past_due so UI reflects it
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = getInvoiceSubscriptionId(invoice)
      if (!subscriptionId) {
        return new Response(JSON.stringify({ received: true }), { headers: getJsonHeaders() })
      }

      const stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
      await syncSubscription(stripeSub, { status: 'past_due' })
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: getJsonHeaders(),
    })
  } catch (e) {
    console.error('Webhook handler error:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: getJsonHeaders(),
    })
  }
})
