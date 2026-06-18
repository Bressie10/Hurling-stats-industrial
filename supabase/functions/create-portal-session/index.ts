import Stripe from 'https://esm.sh/stripe@22.2.1?target=deno&no-check'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getSameOriginReturnUrl, STRIPE_API_VERSION } from '../_shared/billing.ts'
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

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!sub?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: 'No billing account found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { return_url } = await req.json().catch(() => ({ return_url: null }))
    const returnUrl = getSameOriginReturnUrl(return_url)
    const portalConfiguration = Deno.env.get('STRIPE_PORTAL_CONFIGURATION_ID')
    if (!portalConfiguration) {
      return new Response(JSON.stringify({ error: 'Billing portal is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sessionParams: Stripe.BillingPortal.SessionCreateParams = {
      customer: sub.stripe_customer_id,
      return_url: returnUrl,
      configuration: portalConfiguration,
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
    })

    const session = await stripe.billingPortal.sessions.create(sessionParams)

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
