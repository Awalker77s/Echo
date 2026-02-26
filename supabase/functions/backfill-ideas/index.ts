import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenAIResponses } from '../_shared/openai.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface ParsedIdeas {
  ideas: Array<{ content: string; category: string; idea_type: string; details: string }>
}

const ideasSystemPrompt = `You are an idea extraction assistant. Analyze the journal entry and extract any business ideas, creative ideas, goals, or action items. Respond ONLY with a valid JSON object in this exact format, no markdown code fences, no other text:
{
  "ideas": [
    {
      "content": "clear concise description of the idea",
      "category": "business",
      "idea_type": "business_idea",
      "details": "expanded explanation in 2-3 sentences"
    }
  ]
}

Valid values for category: "business", "creative", "goal", "action", "other"
Valid values for idea_type: "business_idea", "problem_solution", "concept", "action_step"

If no ideas are found, return exactly: {"ideas": []}`

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

    // TEMPORARILY DISABLED: Dedup check bypassed for debugging — was potentially blocking all inserts.
    // Re-enable once we confirm ideas are being saved correctly.
    // const { data: existingIdeas, error: existingErr } = await supabase
    //   .from('ideas')
    //   .select('entry_id')
    //   .eq('user_id', userId)
    // if (existingErr) {
    //   throw new Error('Failed to check existing ideas: ' + existingErr.message)
    // }
    // const coveredEntryIds = new Set((existingIdeas ?? []).map((r: { entry_id: string }) => r.entry_id))
    // const uncoveredEntries = entries.filter((e: { id: string }) => !coveredEntryIds.has(e.id))
    // if (uncoveredEntries.length === 0) {
    //   return new Response(
    //     JSON.stringify({ processed: 0, created: 0, message: 'All entries already have ideas.' }),
    //     { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    //   )
    // }

    // Process all entries while dedup is disabled
    const uncoveredEntries = entries as Array<{ id: string; cleaned_entry?: string; raw_transcript?: string; entry_title?: string }>
    console.log('[backfill-ideas] DEDUP DISABLED — processing all entries', { total: uncoveredEntries.length })

    let totalCreated = 0
    let totalProcessed = 0

    for (const entry of uncoveredEntries) {
      const entryText = entry.cleaned_entry || entry.raw_transcript || ''
      if (!entryText.trim()) {
        console.log('[backfill-ideas] Skipping empty entry', entry.id)
        continue
      }

      console.log('[backfill-ideas] Processing entry', { id: entry.id, textLength: entryText.length })

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

      // Log the full raw response before any parsing so we can inspect what OpenAI actually returned
      console.log('[backfill-ideas] Raw ideas response from OpenAI for entry', entry.id, ':', ideasText)

      // Parse with explicit error logging — strip markdown code fences in case OpenAI wraps the JSON
      let ideasJson: ParsedIdeas = { ideas: [] }
      try {
        const cleanedIdeasText = ideasText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
        ideasJson = JSON.parse(cleanedIdeasText) as ParsedIdeas
        if (!Array.isArray(ideasJson.ideas)) {
          console.error('[backfill-ideas] Parsed ideas JSON missing "ideas" array', { entryId: entry.id, ideasJson })
          ideasJson = { ideas: [] }
        }
      } catch (parseErr) {
        console.error('[backfill-ideas] Failed to parse ideas JSON', { entryId: entry.id, error: String(parseErr), ideasText })
      }

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

      // Log the array before inserting to confirm it's not empty and fields are correct
      console.log('[backfill-ideas] Ideas array before Supabase insert for entry', entry.id, ':', JSON.stringify(toInsert))
      const { data: insertedData, error: insertErr } = await supabase.from('ideas').insert(toInsert).select('id')
      // Log result to catch silent failures (schema mismatch, RLS policy, etc.)
      console.log('[backfill-ideas] Supabase insert result for entry', entry.id, ':', { insertedCount: insertedData?.length ?? 0, error: insertErr?.message ?? null })
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
