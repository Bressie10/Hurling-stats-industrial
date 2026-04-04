import Stripe from 'https://esm.sh/stripe@14?target=deno&no-check'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const PRICE_IDS: Record<string, string> = {
  personal: 'price_1TIcATKy0wspuui8EOMD4nyC',
  club:     'price_1TIcB2Ky0wspuui8U61XrY6R',
  club_pro: 'price_1TIcBVKy0wspuui8i7tpzcrl',
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

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !user) return new Response('Unauthorized', { status: 401 })

    const { plan } = await req.json()
    const priceId = PRICE_IDS[plan]
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), { status: 400, headers: corsHeaders })
    }

    const appUrl = req.headers.get('origin') ?? 'https://syikhsgovqogzkmmhuis.supabase.co'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?subscribed=true`,
      cancel_url:  `${appUrl}/?subscribed=cancelled`,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: { plan, seat_limit: String(SEAT_LIMITS[plan]) },
    })

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
