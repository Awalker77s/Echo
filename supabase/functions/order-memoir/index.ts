import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { createAuthedClient } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { supabase, user } = await createAuthedClient(req)

    const userId = user.id
    const { chapterIds } = await req.json()
    const { data: profile } = await supabase.from('users').select('plan').eq('id', userId).single()

    if (!profile || !['memoir', 'lifetime'].includes(profile.plan)) {
      throw new Error('Memoir plan required for print ordering')
    }

    const orderId = `MEM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`

    await supabase.from('memoir_orders').insert({
      user_id: userId,
      order_id: orderId,
      chapter_ids: chapterIds ?? [],
      provider: 'printful-placeholder',
      status: 'submitted',
      provider_response: {
        note: 'Placeholder order created. Integrate with Printful/Blurb API in production.',
      },
    })

    return new Response(JSON.stringify({
      orderId,
      status: 'submitted',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[order-memoir] Unhandled failure', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Request failed. Please try again.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
