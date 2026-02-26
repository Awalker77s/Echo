import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { callOpenAIResponses } from '../_shared/openai.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const userId = typeof body.userId === 'string' ? body.userId : null
    const month = typeof body.month === 'string' ? new Date(body.month) : new Date()

    const firstOfCurrent = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
    const start = new Date(Date.UTC(firstOfCurrent.getUTCFullYear(), firstOfCurrent.getUTCMonth() - 1, 1))
    const end = firstOfCurrent

    const monthDate = start.toISOString().slice(0, 10)

    const targetUsers = userId
      ? [userId]
      : [
          ...new Set(
            (
              (await supabase
                .from('journal_entries')
                .select('user_id')
                .gte('recorded_at', start.toISOString())
                .lt('recorded_at', end.toISOString())).data ?? []
            ).map((row) => row.user_id as string),
          ),
        ]

    let reports = 0

    for (const targetUserId of targetUsers) {
      const { data: entries } = await supabase
        .from('journal_entries')
        .select('id,recorded_at,entry_title,cleaned_entry,mood_primary,mood_score,themes')
        .eq('user_id', targetUserId)
        .gte('recorded_at', start.toISOString())
        .lt('recorded_at', end.toISOString())
        .order('recorded_at', { ascending: true })

      if (!entries?.length) continue

      const prompt = 'Synthesize the month into a third-person compassionate narrative chapter. Highlight emotional arcs, growth moments, recurring themes, and significant events. Return JSON with title, narrative, top_themes, mood_summary, growth_moments.'
      const openAiKey = Deno.env.get('OPENAI_API_KEY')
      if (!openAiKey) throw new Error('OpenAI API key is missing from server configuration.')

      const outputText = await callOpenAIResponses({
        apiKey: openAiKey,
        model: 'gpt-4o',
        temperature: 0.8,
        input: [
          { role: 'system', content: prompt },
          { role: 'user', content: JSON.stringify(entries) },
        ],
      })

      let chapter: {
        title: string
        narrative: string
        top_themes: string[]
        mood_summary: Record<string, unknown>
        growth_moments: unknown[]
      } = {
        title: 'Monthly Chapter',
        narrative: 'No narrative generated.',
        top_themes: [],
        mood_summary: {},
        growth_moments: [],
      }

      try {
        chapter = JSON.parse(outputText)
      } catch {
        // keep fallback
      }

      const { error } = await supabase.from('chapter_reports').upsert(
        {
          user_id: targetUserId,
          month: monthDate,
          title: chapter.title,
          narrative: chapter.narrative,
          top_themes: chapter.top_themes,
          mood_summary: chapter.mood_summary,
          growth_moments: chapter.growth_moments,
          entry_count: entries.length,
        },
        { onConflict: 'user_id,month' },
      )
      if (!error) reports += 1
    }

    return new Response(JSON.stringify({ month: monthDate, reportsGenerated: reports, usersProcessed: targetUsers.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[generate-chapter] Unhandled failure', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Request failed. Please try again.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
