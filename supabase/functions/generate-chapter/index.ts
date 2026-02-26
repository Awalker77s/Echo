import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { callOpenAIResponses } from '../_shared/openai.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[generate-chapter] Missing Supabase config', { hasUrl: Boolean(supabaseUrl), hasKey: Boolean(serviceRoleKey) })
      throw new Error('Server is missing Supabase configuration.')
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey)

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

      const prompt = `You are a gifted memoirist writing a chapter of someone's life story. Based on these journal entries from the past month, craft a compelling, personal narrative chapter.

Write in the third person with warmth and literary grace. The chapter should:
- Read like a short story from a memoir — not a summary or bullet points
- Weave together the themes, emotions, growth, and key moments into a cohesive narrative arc
- Include an opening that sets the scene and a closing that offers reflection
- Capture the emotional journey: where they started the month, what they went through, and where they ended up
- Highlight turning points, small victories, challenges faced, and moments of clarity
- Use vivid, specific details drawn from the entries to make it feel personal and real
- Feel like something the person would treasure reading back years later

Return JSON with:
- title: an evocative chapter title (not just the month name)
- narrative: the full narrative text (multiple paragraphs separated by newlines, at least 4-6 paragraphs)
- top_themes: array of 3-5 key themes from the month
- mood_summary: object with "overall" (the dominant emotional tone), "arc" (how mood shifted across the month), and "highlights" (array of notable emotional moments)
- growth_moments: array of objects with "moment" (description of a growth moment) and "significance" (why it matters)`
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
        const cleanedText = outputText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim()
        chapter = JSON.parse(cleanedText)
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
