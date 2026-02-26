import { env } from './env'
import { supabase } from './supabase'

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

async function callOpenAI(entryText: string, apiKey: string): Promise<ParsedIdeas> {
  console.log('1. Entry text being sent to OpenAI:', entryText)

  const body = {
    model: 'gpt-4o',
    temperature: 0.4,
    instructions: ideasSystemPrompt,
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
    console.error('2. Raw OpenAI error response:', text)
    throw new Error(`OpenAI API failed (${response.status}): ${text}`)
  }

  interface ResponsePayload {
    output?: Array<{
      type: string
      content?: Array<{ type: string; text?: string }>
    }>
  }
  const payload = await response.json() as ResponsePayload
  console.log('2. Raw OpenAI response:', JSON.stringify(payload, null, 2))

  const outputText =
    payload.output?.[0]?.content?.find((c) => c.type === 'output_text')?.text ?? ''
  console.log('2b. Extracted output text:', outputText)

  try {
    const cleanedText = outputText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleanedText) as ParsedIdeas
    console.log('3. Parsed ideas array:', parsed.ideas)
    return parsed
  } catch (parseErr) {
    console.error('3. JSON parse failed — outputText was:', outputText, 'Error:', parseErr)
    return { ideas: [] }
  }
}

export async function backfillIdeas(): Promise<{ processed: number; created: number; message: string }> {
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

  console.log('[backfillIdeas] Total journal entries fetched:', entries?.length ?? 0)

  if (!entries || entries.length === 0) {
    return { processed: 0, created: 0, message: 'No journal entries found.' }
  }

  // Find entry IDs that already have ideas
  const { data: existingIdeas, error: existingErr } = await supabase
    .from('ideas')
    .select('entry_id')
    .eq('user_id', userId)

  if (existingErr) {
    throw new Error('Failed to check existing ideas: ' + existingErr.message)
  }

  const coveredEntryIds = new Set((existingIdeas ?? []).map((r: { entry_id: string }) => r.entry_id))
  console.log('[backfillIdeas] Entries already covered by existing ideas:', coveredEntryIds.size)

  const uncoveredEntries = entries.filter(
    (e: { id: string }) => !coveredEntryIds.has(e.id),
  ) as Array<{ id: string; cleaned_entry?: string; raw_transcript?: string; entry_title?: string }>

  console.log('[backfillIdeas] Uncovered entries to process:', uncoveredEntries.length)

  if (uncoveredEntries.length === 0) {
    return { processed: 0, created: 0, message: 'All entries already have ideas.' }
  }

  let totalCreated = 0
  let totalProcessed = 0

  for (const entry of uncoveredEntries) {
    const entryText = entry.cleaned_entry || entry.raw_transcript || ''
    console.log(`[backfillIdeas] Entry ${entry.id} — cleaned_entry length: ${entry.cleaned_entry?.length ?? 0}, raw_transcript length: ${entry.raw_transcript?.length ?? 0}, combined text length: ${entryText.length}`)
    if (!entryText.trim()) {
      console.warn(`[backfillIdeas] Skipping entry ${entry.id} — text is empty or whitespace-only`)
      continue
    }

    let ideasJson: ParsedIdeas = { ideas: [] }
    try {
      ideasJson = await callOpenAI(entryText, apiKey)
    } catch (err) {
      console.error('[backfillIdeas] OpenAI call failed for entry', entry.id, err)
      continue
    }

    if (ideasJson.ideas.length === 0) {
      console.warn(`[backfillIdeas] Entry ${entry.id} — OpenAI returned 0 ideas`)
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
    console.log(`[backfillIdeas] Entry ${entry.id} — attempting to insert ${toInsert.length} ideas:`, JSON.stringify(toInsert, null, 2))

    const insertResult = await supabase.from('ideas').insert(toInsert).select('id')
    const { data: insertData, error: insertErr } = insertResult
    console.log('4. Supabase insert result:', JSON.stringify({ insertedRows: insertData, error: insertErr }, null, 2))
    if (insertErr) {
      console.error('[backfillIdeas] Insert failed:', JSON.stringify(insertResult, null, 2))
    } else {
      totalCreated += toInsert.length
    }

    totalProcessed++
  }

  return {
    processed: totalProcessed,
    created: totalCreated,
    message: `Processed ${totalProcessed} entries and created ${totalCreated} new ideas.`,
  }
}
