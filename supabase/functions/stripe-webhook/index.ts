import Stripe from 'https://esm.sh/stripe@14?target=deno&no-check'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const PLAN_BY_PRICE: Record<string, string> = {
  'price_1TIcATKy0wspuui8EOMD4nyC': 'personal',
  'price_1TIcB2Ky0wspuui8U61XrY6R': 'club',
  'price_1TIcBVKy0wspuui8i7tpzcrl': 'club_pro',
}

const SEAT_LIMITS: Record<string, number> = {
  personal: 1,
  club:     999,
  club_pro: 999,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch (e) {
    console.error('Webhook signature verification failed:', e.message)
    return new Response(`Webhook error: ${e.message}`, { status: 400 })
  }

  try {
    // ── checkout.session.completed ──────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.client_reference_id
      if (!userId) throw new Error('No client_reference_id on session')

      const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string)
      const priceId = stripeSub.items.data[0]?.price.id
      const plan = PLAN_BY_PRICE[priceId] ?? 'personal'
      const periodEnd = new Date(stripeSub.current_period_end * 1000).toISOString()

      const { error } = await supabase.from('subscriptions')
        .update({
          plan,
          status: stripeSub.status,
          seat_limit: SEAT_LIMITS[plan] ?? 1,
          current_period_end: periodEnd,
          cancel_at_period_end: stripeSub.cancel_at_period_end ?? false,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
        })
        .eq('user_id', userId)

      if (error) throw new Error(`DB update failed: ${error.message}`)

    // ── customer.subscription.updated ──────────────────────────────────
    } else if (event.type === 'customer.subscription.updated') {
      const stripeSub = event.data.object as Stripe.Subscription
      const priceId = stripeSub.items.data[0]?.price.id
      const plan = PLAN_BY_PRICE[priceId] ?? 'personal'
      const periodEnd = new Date(stripeSub.current_period_end * 1000).toISOString()

      const { error } = await supabase.from('subscriptions')
        .update({
          plan,
          status: stripeSub.status,
          seat_limit: SEAT_LIMITS[plan] ?? 1,
          current_period_end: periodEnd,
          cancel_at_period_end: stripeSub.cancel_at_period_end ?? false,
        })
        .eq('stripe_subscription_id', stripeSub.id)

      if (error) throw new Error(`DB update failed: ${error.message}`)

    // ── customer.subscription.deleted ───────────────────────────────────
    } else if (event.type === 'customer.subscription.deleted') {
      const stripeSub = event.data.object as Stripe.Subscription

      const { error } = await supabase.from('subscriptions')
        .update({ plan: 'free', status: 'cancelled', seat_limit: 1, cancel_at_period_end: false })
        .eq('stripe_subscription_id', stripeSub.id)

      if (error) throw new Error(`DB update failed: ${error.message}`)

    // ── invoice.payment_succeeded ───────────────────────────────────────
    // Keeps period end fresh on every renewal so Pro access never lapses
    } else if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice
      if (!invoice.subscription) {
        return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
      }
      const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription as string)
      const periodEnd = new Date(stripeSub.current_period_end * 1000).toISOString()

      await supabase.from('subscriptions')
        .update({ status: 'active', current_period_end: periodEnd, cancel_at_period_end: false })
        .eq('stripe_subscription_id', stripeSub.id)

    // ── invoice.payment_failed ──────────────────────────────────────────
    // Stripe retries automatically; mark past_due so UI reflects it
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      if (!invoice.subscription) {
        return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
      }

      await supabase.from('subscriptions')
        .update({ status: 'past_due' })
        .eq('stripe_subscription_id', invoice.subscription as string)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Webhook handler error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})
