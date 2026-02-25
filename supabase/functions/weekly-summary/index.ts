import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import OpenAI from 'https://esm.sh/openai@4.86.1'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) throw new Error('Unauthorized')

    const userId = userData.user.id
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: entries } = await supabase
      .from('journal_entries')
      .select('entry_title, cleaned_entry, mood_primary, recorded_at')
      .eq('user_id', userId)
      .gte('recorded_at', oneWeekAgo)
      .order('recorded_at', { ascending: true })

    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') })
    const prompt = `Create a concise, warm weekly reflection summary email from journal entries. Include 3 bullet highlights and one gentle next-step suggestion.`

    const response = await openai.responses.create({
      model: 'gpt-4o',
      temperature: 0.6,
      input: [
        { role: 'system', content: prompt },
        { role: 'user', content: JSON.stringify(entries ?? []) },
      ],
    })

    const summary = response.output_text

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (resendApiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('RESEND_FROM_EMAIL') ?? 'Echo Journal <weekly@echojournal.app>',
          to: [userData.user.email],
          subject: 'Your Echo Journal weekly reflection',
          text: summary,
        }),
      })
    }

    return new Response(JSON.stringify({ summary, emailed: Boolean(resendApiKey) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
