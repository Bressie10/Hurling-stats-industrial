import Stripe from 'https://esm.sh/stripe@22.2.1?target=deno&no-check'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getAppBaseUrl,
  getPriceIds,
  getSeatLimit,
  parseBillingPlan,
  STRIPE_API_VERSION,
} from '../_shared/billing.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token)
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const plan = parseBillingPlan(body.plan)
    if (!plan) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const priceId = getPriceIds()[plan]
    const seatLimit = getSeatLimit(plan)

    // Reuse existing Stripe customer if we have one — avoids duplicate customers on resubscribe
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const appUrl = getAppBaseUrl()

    const sessionParams: Record<string, unknown> = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?subscribed=true`,
      cancel_url: `${appUrl}/?subscribed=cancelled`,
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan, seat_limit: String(seatLimit) },
      subscription_data: {
        metadata: { user_id: user.id, plan, seat_limit: String(seatLimit) },
      },
    }

    if (existingSub?.stripe_customer_id) {
      sessionParams.customer = existingSub.stripe_customer_id
    } else {
      sessionParams.customer_email = user.email
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
    })

    const session = await stripe.checkout.sessions.create(
      sessionParams as Stripe.Checkout.SessionCreateParams,
    )

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
