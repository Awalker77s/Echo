import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenAIResponses } from '../_shared/openai.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface ParsedIdeas {
  ideas: Array<{ content: string; category: string; idea_type: string; details: string }>
}

const ideasSystemPrompt = `You are an AI idea extraction helper. Analyze this journal entry and extract actionable ideas. For each idea found, return it with:
- content: a clear, concise description of the idea
- category: one of "business", "creative", "goal", "action", "other"
- idea_type: one of "business_idea" (potential business or money-making concepts), "problem_solution" (ways to solve problems mentioned), "concept" (interesting concepts worth developing further), "action_step" (specific actionable next steps or creative directions)
- details: an expanded explanation (2-3 sentences) that develops the idea further, suggests how to pursue it, or explains why it's worth exploring

Look for:
- Business ideas mentioned or implied
- Solutions to problems the user describes
- Concepts worth developing and expanding on
- Actionable next steps or creative directions

Return JSON with an ideas array. If no clear ideas are found, still try to surface at least one actionable suggestion based on what the user is thinking about.`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openAiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Server is missing Supabase configuration.')
    }
    if (!openAiKey) {
      throw new Error('OpenAI API key is missing from server configuration.')
    }

    const authorization = req.headers.get('Authorization') ?? ''
    const token = authorization.replace(/^Bearer\s+/i, '').trim()

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authorization } },
    })

    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData.user) {
      throw new Error('Unauthorized')
    }

    const userId = userData.user.id
    console.log('[backfill-ideas] Starting backfill for user', userId)

    // Find entries that have no ideas associated with them yet
    const { data: entries, error: entriesErr } = await supabase
      .from('journal_entries')
      .select('id, cleaned_entry, raw_transcript, entry_title')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })

    if (entriesErr) {
      throw new Error('Failed to fetch journal entries: ' + entriesErr.message)
    }

    if (!entries || entries.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, created: 0, message: 'No journal entries found.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch entry IDs that already have at least one idea
    const { data: existingIdeas, error: existingErr } = await supabase
      .from('ideas')
      .select('entry_id')
      .eq('user_id', userId)

    if (existingErr) {
      throw new Error('Failed to check existing ideas: ' + existingErr.message)
    }

    const coveredEntryIds = new Set((existingIdeas ?? []).map((r: { entry_id: string }) => r.entry_id))

    const uncoveredEntries = entries.filter(
      (e: { id: string }) => !coveredEntryIds.has(e.id),
    ) as Array<{ id: string; cleaned_entry?: string; raw_transcript?: string; entry_title?: string }>

    console.log('[backfill-ideas] Entries needing ideas', {
      total: entries.length,
      alreadyCovered: coveredEntryIds.size,
      toProcess: uncoveredEntries.length,
    })

    if (uncoveredEntries.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, created: 0, message: 'All entries already have ideas.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let totalCreated = 0
    let totalProcessed = 0

    for (const entry of uncoveredEntries) {
      const entryText = entry.cleaned_entry || entry.raw_transcript || ''
      if (!entryText.trim()) {
        console.log('[backfill-ideas] Skipping empty entry', entry.id)
        continue
      }

      console.log('[backfill-ideas] Processing entry', { id: entry.id, textLength: entryText.length })

      const safeParse = <T>(text: string, fallback: T): T => {
        try { return JSON.parse(text) as T } catch { return fallback }
      }

      let ideasText = ''
      try {
        ideasText = await callOpenAIResponses({
          model: 'gpt-4o',
          temperature: 0.4,
          apiKey: openAiKey,
          input: [
            { role: 'system', content: ideasSystemPrompt },
            { role: 'user', content: entryText },
          ],
        })
      } catch (err) {
        console.error('[backfill-ideas] OpenAI call failed for entry', entry.id, err)
        continue
      }

      const ideasJson = safeParse<ParsedIdeas>(ideasText, { ideas: [] })
      console.log('[backfill-ideas] Extracted ideas for entry', {
        entryId: entry.id,
        count: ideasJson.ideas.length,
      })

      if (ideasJson.ideas.length === 0) {
        totalProcessed++
        continue
      }

      const toInsert = ideasJson.ideas.map((idea) => ({
        user_id: userId,
        entry_id: entry.id,
        content: idea.content,
        category: idea.category,
        idea_type: idea.idea_type ?? 'concept',
        details: idea.details ?? '',
      }))

      const { error: insertErr } = await supabase.from('ideas').insert(toInsert)
      if (insertErr) {
        console.error('[backfill-ideas] Insert failed for entry', entry.id, insertErr.message)
      } else {
        totalCreated += toInsert.length
      }

      totalProcessed++
    }

    console.log('[backfill-ideas] Done', { totalProcessed, totalCreated })

    return new Response(
      JSON.stringify({
        processed: totalProcessed,
        created: totalCreated,
        message: `Processed ${totalProcessed} entries and created ${totalCreated} new ideas.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[backfill-ideas] Unhandled failure', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Backfill failed.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
