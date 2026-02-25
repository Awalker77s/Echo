import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@16.12.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Unauthorized')

    const { plan } = await req.json()
    const priceMap: Record<string, string | undefined> = {
      core: Deno.env.get('STRIPE_PRICE_CORE'),
      memoir: Deno.env.get('STRIPE_PRICE_MEMOIR'),
      lifetime: Deno.env.get('STRIPE_PRICE_LIFETIME'),
    }

    const price = priceMap[plan]
    if (!price) throw new Error('Invalid gift plan')

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-10-28.acacia' })
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price, quantity: 1 }],
      success_url: `${Deno.env.get('SITE_URL')}/gifts?checkout=success`,
      cancel_url: `${Deno.env.get('SITE_URL')}/gifts?checkout=cancelled`,
      customer_email: userData.user.email,
      metadata: {
        gift: 'true',
        plan,
        purchaser_id: userData.user.id,
      },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
