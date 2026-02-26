import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@16.12.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'

function makeGiftCode() {
  return `ECHO-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (!stripeKey || !webhookSecret) throw new Error('Stripe webhook secrets are not configured.')

    const body = await req.text()
    const signature = req.headers.get('stripe-signature')
    if (!signature) throw new Error('Missing Stripe signature header.')

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-10-28.acacia' })
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const isGift = session.metadata?.gift === 'true'

      if (isGift) {
        const purchaserId = session.metadata?.purchaser_id
        const plan = session.metadata?.plan ?? 'core'
        if (!purchaserId) throw new Error('Missing purchaser id for gift checkout.')

        const { error } = await supabase.from('gift_codes').insert({
          purchaser_user_id: purchaserId,
          plan,
          code: makeGiftCode(),
          stripe_checkout_session_id: session.id,
        })
        if (error) throw new Error('Failed to create gift code.')
      } else {
        const userId = session.client_reference_id
        if (!userId) throw new Error('Missing client reference user id.')

        const plan = session.mode === 'payment' ? 'lifetime' : session.metadata?.plan ?? 'core'
        const { error } = await supabase
          .from('users')
          .update({
            plan,
            stripe_customer_id: session.customer?.toString() ?? null,
            stripe_subscription_id: session.subscription?.toString() ?? null,
          })
          .eq('id', userId)
        if (error) throw new Error('Failed to update user subscription details.')
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const { error } = await supabase
        .from('users')
        .update({ plan: 'free', stripe_subscription_id: null })
        .eq('stripe_subscription_id', subscription.id)
      if (error) throw new Error('Failed to downgrade subscription on cancellation.')
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[stripe-webhook] Unhandled failure', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Webhook handling failed.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
