import { env } from './env'
import { supabase } from './supabase'

interface ParsedInsights {
  insights: Array<{ content: string; insight_type: string }>
}

const insightsSystemPrompt = `You are a personal growth and reflection assistant. Analyze this journal entry and generate meaningful insights about the person's thoughts, behaviors, and patterns. For each insight return:
- content: a thoughtful, personalized observation or piece of advice (2-3 sentences)
- insight_type: one of "pattern", "reflection", "advice", "growth", "warning"

Return ONLY a valid JSON object in this format with no markdown fences:
{ "insights": [ { "content": "...", "insight_type": "..." } ] }`

async function callOpenAI(entryText: string, apiKey: string): Promise<ParsedInsights> {
  console.log('[backfillInsights] 1. Entry text being sent to OpenAI (preview):', entryText.slice(0, 200))

  const body = {
    model: 'gpt-4o',
    temperature: 0.4,
    instructions: insightsSystemPrompt,
    input: [{ role: 'user', content: entryText }],
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('[backfillInsights] 2. Raw OpenAI error response:', text)
    throw new Error(`OpenAI API failed (${response.status}): ${text}`)
  }

  interface ResponsePayload {
    output?: Array<{
      type: string
      content?: Array<{ type: string; text?: string }>
    }>
  }
  const payload = await response.json() as ResponsePayload
  console.log('[backfillInsights] 2. Raw OpenAI response:', JSON.stringify(payload, null, 2))

  const outputText =
    payload.output?.[0]?.content?.find((c) => c.type === 'output_text')?.text ?? ''
  console.log('[backfillInsights] 2b. Extracted output text:', outputText)

  try {
    const cleanedText = outputText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleanedText) as ParsedInsights
    console.log('[backfillInsights] 3. Parsed insights array:', parsed.insights)
    return parsed
  } catch (parseErr) {
    console.error('[backfillInsights] 3. JSON parse failed — outputText was:', outputText, 'Error:', parseErr)
    return { insights: [] }
  }
}

export async function backfillInsights(): Promise<{ processed: number; created: number; message: string }> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const apiKey = env.openAiKey
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Set VITE_OPENAI_API_KEY in your .env file.')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (!userId) {
    throw new Error('You must be logged in to run this operation.')
  }

  // Fetch all journal entries for this user
  const { data: entries, error: entriesErr } = await supabase
    .from('journal_entries')
    .select('id, cleaned_entry, raw_transcript, entry_title')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })

  if (entriesErr) {
    throw new Error('Failed to fetch journal entries: ' + entriesErr.message)
  }

  console.log('[backfillInsights] Total journal entries fetched:', entries?.length ?? 0)

  if (!entries || entries.length === 0) {
    return { processed: 0, created: 0, message: 'No journal entries found.' }
  }

  // Find entry IDs that already have insights to avoid duplicates
  const { data: existingInsights, error: existingErr } = await supabase
    .from('insights')
    .select('entry_id')
    .eq('user_id', userId)

  if (existingErr) {
    throw new Error('Failed to check existing insights: ' + existingErr.message)
  }

  const coveredEntryIds = new Set((existingInsights ?? []).map((r: { entry_id: string }) => r.entry_id))
  console.log('[backfillInsights] Entries already covered by existing insights:', coveredEntryIds.size)

  const uncoveredEntries = entries.filter(
    (e: { id: string }) => !coveredEntryIds.has(e.id),
  ) as Array<{ id: string; cleaned_entry?: string; raw_transcript?: string; entry_title?: string }>

  console.log('[backfillInsights] Uncovered entries to process:', uncoveredEntries.length)

  if (uncoveredEntries.length === 0) {
    return { processed: 0, created: 0, message: 'All entries already have insights.' }
  }

  let totalCreated = 0
  let totalProcessed = 0

  for (const entry of uncoveredEntries) {
    const entryText = entry.cleaned_entry || entry.raw_transcript || ''
    console.log(`[backfillInsights] Entry ${entry.id} — cleaned_entry length: ${entry.cleaned_entry?.length ?? 0}, raw_transcript length: ${entry.raw_transcript?.length ?? 0}`)
    if (!entryText.trim()) {
      console.warn(`[backfillInsights] Skipping entry ${entry.id} — text is empty or whitespace-only`)
      continue
    }

    let insightsJson: ParsedInsights = { insights: [] }
    try {
      insightsJson = await callOpenAI(entryText, apiKey)
    } catch (err) {
      console.error('[backfillInsights] OpenAI call failed for entry', entry.id, err)
      continue
    }

    if (insightsJson.insights.length === 0) {
      console.warn(`[backfillInsights] Entry ${entry.id} — OpenAI returned 0 insights`)
      totalProcessed++
      continue
    }

    const toInsert = insightsJson.insights.map((insight) => ({
      user_id: userId,
      entry_id: entry.id,
      content: insight.content,
      insight_type: insight.insight_type ?? 'reflection',
    }))
    console.log(`[backfillInsights] Entry ${entry.id} — attempting to insert ${toInsert.length} insights:`, JSON.stringify(toInsert, null, 2))

    const { data: insertData, error: insertErr } = await supabase.from('insights').insert(toInsert).select('id')
    if (insertErr) {
      console.error('[backfillInsights] Insert failed:', {
        message: insertErr?.message,
        code: insertErr?.code,
        hint: insertErr?.hint,
      })
    } else {
      totalCreated += toInsert.length
      console.log(`[backfillInsights] Entry ${entry.id} — inserted ${insertData?.length ?? 0} insights`)
    }

    totalProcessed++
  }

  return {
    processed: totalProcessed,
    created: totalCreated,
    message: `Processed ${totalProcessed} entries and created ${totalCreated} new insights.`,
  }
}
