import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
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

    const { code } = await req.json()
    if (!code) throw new Error('Missing gift code')

    const { data: giftCode, error: codeError } = await supabase
      .from('gift_codes')
      .select('*')
      .eq('code', String(code).trim().toUpperCase())
      .is('redeemed_at', null)
      .single()

    if (codeError || !giftCode) throw new Error('Invalid or already redeemed code')

    await supabase.from('users').update({ plan: giftCode.plan }).eq('id', userData.user.id)

    await supabase.from('gift_codes').update({
      redeemed_at: new Date().toISOString(),
      redeemed_by_user_id: userData.user.id,
    }).eq('id', giftCode.id)

    return new Response(JSON.stringify({ redeemed: true, plan: giftCode.plan }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Request failed. Please try again.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
