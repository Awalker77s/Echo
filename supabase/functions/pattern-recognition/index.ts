import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import OpenAI from 'https://esm.sh/openai@4.86.1'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'

interface PatternResult {
  pattern_type: string
  description: string
  evidence: { entry_id: string; quote: string }[]
  confidence: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') })

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

      const systemPrompt = 'Analyze journal entries from the past 30 days and identify recurring patterns. Look for recurring topics, mood triggers/correlations, time-of-day emotional patterns, person associations, and resurfacing goals. Return JSON array with fields pattern_type, description, evidence [{entry_id, quote}], confidence (0 to 1).'
      const response = await openai.responses.create({
        model: 'gpt-4o',
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(inputForAi) },
        ],
      })

      let patterns: PatternResult[] = []
      try {
        patterns = JSON.parse(response.output_text) as PatternResult[]
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Request failed. Please try again.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
