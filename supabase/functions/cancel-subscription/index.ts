import Stripe from 'https://esm.sh/stripe@22.2.1?target=deno&no-check'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { STRIPE_API_VERSION } from '../_shared/billing.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: STRIPE_API_VERSION,
    })
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401 })

    // Same auth pattern as create-checkout-session (service role + getUser)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !user) return new Response('Unauthorized', { status: 401 })

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!sub?.stripe_subscription_id) {
      // No Stripe subscription — nothing to cancel, not an error
      return new Response(JSON.stringify({ success: true, noop: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Cancel at period end — user keeps access until billing cycle ends
    // The customer.subscription.updated webhook will sync cancel_at_period_end to the DB
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
