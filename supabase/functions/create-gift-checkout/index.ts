import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@16.12.0'
import { corsHeaders } from '../_shared/cors.ts'
import { createAuthedClient } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const siteUrl = Deno.env.get('SITE_URL')
    if (!stripeKey || !siteUrl) throw new Error('Stripe is not configured on the server.')

    const { supabase, user } = await createAuthedClient(req)

    const { plan } = await req.json()
    const priceMap: Record<string, string | undefined> = {
      core: Deno.env.get('STRIPE_PRICE_CORE'),
      memoir: Deno.env.get('STRIPE_PRICE_MEMOIR'),
      lifetime: Deno.env.get('STRIPE_PRICE_LIFETIME'),
    }

    const price = priceMap[plan]
    if (!price) throw new Error('Invalid gift plan selected.')

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-10-28.acacia' })
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price, quantity: 1 }],
      success_url: `${siteUrl}/subscription?checkout=success`,
      cancel_url: `${siteUrl}/subscription?checkout=cancelled`,
      customer_email: user.email,
      metadata: {
        gift: 'true',
        plan,
        purchaser_id: user.id,
      },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[create-gift-checkout] Unhandled failure', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to create gift checkout.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
