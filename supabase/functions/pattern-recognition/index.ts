import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { callOpenAIResponses } from '../_shared/openai.ts'

interface PatternResult {
  pattern_type: string
  description: string
  evidence: { entry_id: string; quote: string }[]
  confidence: number
  advice: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[pattern-recognition] Missing Supabase config', { hasUrl: Boolean(supabaseUrl), hasKey: Boolean(serviceRoleKey) })
      throw new Error('Server is missing Supabase configuration.')
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const targetUserId = typeof body.userId === 'string' ? body.userId : null

    let userIds: string[] = []
    if (targetUserId) {
      userIds = [targetUserId]
    } else {
      const { data: users } = await supabase
        .from('journal_entries')
        .select('user_id')
        .gte('recorded_at', thirtyDaysAgo)
      userIds = [...new Set((users ?? []).map((row) => row.user_id as string))]
    }

    let patternCount = 0

    for (const userId of userIds) {
      const { data: entries } = await supabase
        .from('journal_entries')
        .select('id,recorded_at,cleaned_entry,mood_primary,mood_score,themes,people_mentioned')
        .eq('user_id', userId)
        .gte('recorded_at', thirtyDaysAgo)
        .order('recorded_at', { ascending: true })

      if (!entries?.length) continue

      const inputForAi = entries.map((entry) => ({
        entry_id: entry.id,
        recorded_at: entry.recorded_at,
        mood_primary: entry.mood_primary,
        mood_score: entry.mood_score,
        themes: entry.themes,
        people_mentioned: entry.people_mentioned,
        text: entry.cleaned_entry,
      }))

      const systemPrompt = `Analyze these journal entries from the past 30 days and generate meaningful insights. You are a thoughtful, empathetic advisor who notices patterns, behaviors, and themes in someone's life.

For each insight you discover, provide:
- pattern_type: a category label (e.g. "emotional_pattern", "growth_area", "recurring_theme", "relationship_dynamic", "self_care", "goal_progress", "mindset_shift", "stress_trigger")
- description: a clear, compassionate description of the pattern or theme you noticed
- evidence: array of [{entry_id, quote}] with specific quotes from entries that support this insight
- confidence: 0 to 1 indicating how strongly the evidence supports this insight
- advice: a thoughtful, constructive piece of guidance (2-3 sentences) that feels like a reflection from a wise friend — not a generic tip, but a personalized observation that offers perspective, encouragement, or a gentle nudge toward growth based on what the user has been journaling about

Focus on generating insights that are genuinely helpful — reflecting on what's going well, what might need attention, and constructive ways to think about challenges. These should feel like thoughtful reflections, not clinical assessments.

Return a JSON array.`
      const openAiKey = Deno.env.get('OPENAI_API_KEY')
      if (!openAiKey) throw new Error('OpenAI API key is missing from server configuration.')

      const outputText = await callOpenAIResponses({
        apiKey: openAiKey,
        model: 'gpt-4o',
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(inputForAi) },
        ],
      })

      let patterns: PatternResult[] = []
      try {
        const cleanedText = outputText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim()
        patterns = JSON.parse(cleanedText) as PatternResult[]
      } catch {
        patterns = []
      }

      if (!patterns.length) continue

      await supabase
        .from('patterns')
        .delete()
        .eq('user_id', userId)
        .eq('dismissed', false)

      const rows = patterns
        .filter((pattern) => pattern.description && pattern.pattern_type)
        .map((pattern) => ({
          user_id: userId,
          pattern_type: pattern.pattern_type,
          description: pattern.description,
          evidence: pattern.evidence ?? [],
          confidence: Math.max(0, Math.min(1, Number(pattern.confidence ?? 0))),
          advice: pattern.advice ?? '',
          surfaced_at: new Date().toISOString(),
          dismissed: false,
        }))

      if (rows.length) {
        await supabase.from('patterns').insert(rows)
        patternCount += rows.length
      }
    }

    return new Response(JSON.stringify({ usersProcessed: userIds.length, patternsInserted: patternCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[pattern-recognition] Unhandled failure', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Request failed. Please try again.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
