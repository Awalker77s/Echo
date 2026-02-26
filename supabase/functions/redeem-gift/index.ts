import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { createAuthedClient } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { supabase, user } = await createAuthedClient(req)

    const { code } = await req.json()
    if (!code) throw new Error('Missing gift code')

    const { data: giftCode, error: codeError } = await supabase
      .from('gift_codes')
      .select('*')
      .eq('code', String(code).trim().toUpperCase())
      .is('redeemed_at', null)
      .single()

    if (codeError || !giftCode) throw new Error('Invalid or already redeemed code')

    await supabase.from('users').update({ plan: giftCode.plan }).eq('id', user.id)

    await supabase.from('gift_codes').update({
      redeemed_at: new Date().toISOString(),
      redeemed_by_user_id: user.id,
    }).eq('id', giftCode.id)

    return new Response(JSON.stringify({ redeemed: true, plan: giftCode.plan }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[redeem-gift] Unhandled failure', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Request failed. Please try again.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
