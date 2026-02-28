import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenAIResponses, callWhisperTranscription } from '../_shared/openai.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface ParsedJournal { title: string; entry: string }
interface ParsedMood { mood_primary: string; mood_score: number; mood_tags: string[]; mood_level: string; mood_reasoning?: string }
interface ParsedIdeas { ideas: Array<{ content: string; category: string; idea_type: string; details: string }> }
interface ParsedInsights { insights: Array<{ content: string; insight_type: string }> }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openAiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[process-recording] Missing Supabase config', { hasSupabaseUrl: Boolean(supabaseUrl), hasServiceRoleKey: Boolean(serviceRoleKey) })
      throw new Error('Server is missing Supabase configuration.')
    }

    if (!openAiKey) {
      console.error('[process-recording] Missing OpenAI key')
      throw new Error('OpenAI API key is missing from server configuration.')
    }

    const authorization = req.headers.get('Authorization') ?? ''
    const token = authorization.replace(/^Bearer\s+/i, '').trim()

    console.log('[process-recording] Starting auth check', {
      hasAuthorizationHeader: Boolean(authorization),
      tokenLength: token.length,
    })

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authorization } },
    })

    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData.user) {
      console.error('[process-recording] Auth check failed', { error: userErr?.message ?? 'No user returned' })
      throw new Error('Unauthorized')
    }

    console.log('[process-recording] Auth check passed', { userId: userData.user.id })

    const userId = userData.user.id

    console.log('[process-recording] Loading user plan')
    const { data: profile, error: profileError } = await supabase.from('users').select('plan').eq('id', userId).single()
    if (profileError) {
      console.error('[process-recording] Failed to load profile', { error: profileError.message, userId })
      throw new Error('Unable to verify subscription plan.')
    }

    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    console.log('[process-recording] Checking monthly recording count', { userId, monthStart })
    const { count: monthCount, error: countError } = await supabase
      .from('journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('recorded_at', monthStart)
    if (countError) {
      console.error('[process-recording] Failed count query', { error: countError.message, userId })
      throw new Error('Unable to check monthly recording limit.')
    }

    if ((profile?.plan ?? 'free') === 'free' && (monthCount ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: 'Free tier monthly recording limit reached. Upgrade to continue.' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const formData = await req.formData()
    const audio = formData.get('audio')
    if (!(audio instanceof File)) {
      console.error('[process-recording] Missing audio file in form data')
      throw new Error('Missing audio file upload.')
    }

    const audioPath = `${userId}/${crypto.randomUUID()}.webm`
    console.log('[process-recording] Uploading audio', { audioPath, size: audio.size, type: audio.type })
    const { error: uploadError } = await supabase.storage.from('journal-audio').upload(audioPath, audio, {
      contentType: audio.type || 'audio/webm',
      upsert: false,
    })
    if (uploadError) {
      console.error('[process-recording] Audio upload failed', { error: uploadError.message, audioPath })
      throw new Error('Failed to upload audio to storage.')
    }

    console.log('[process-recording] Calling Whisper transcription')
    const transcript = await callWhisperTranscription({ apiKey: openAiKey, audio })

    console.log('[process-recording] Transcript received', {
      transcriptLength: transcript.length,
      transcriptPreview: transcript.slice(0, 120),
    })
    console.log('[process-recording] Calling OpenAI journal/mood/idea prompts')
    const moodSystemPrompt = `You are a mood classification engine for a personal journal app. Your job is to detect emotional distress accurately — never underreport negativity.

Respond ONLY with a valid JSON object with these exact fields (no markdown code fences, no preamble, no explanation text — raw JSON only):
- mood_primary: a single descriptive word capturing the dominant emotion (e.g. "anxious", "drained", "content", "joyful")
- mood_score: a float from -1.0 (most negative) to +1.0 (most positive)
- mood_tags: array of 2-4 mood descriptor words
- mood_level: classify into exactly one of: "Extremely Positive", "Positive", "Neutral", "Negative", "Extremely Negative"
- mood_reasoning: a single sentence explaining why you chose this classification (used for debugging)

CRITICAL CLASSIFICATION RULES:
1. If the entry contains ANY significant negative emotional language — even alongside positive content — classify as "Negative" or "Extremely Negative". Do NOT average away the negativity.
2. "Neutral" means genuinely balanced or emotionally uneventful (routine, nothing notable happened). It is a NARROW band. Reserve it only for entries with no meaningful positive or negative emotion.
3. Negation flips meaning: "not great", "wasn't happy", "can't seem to", "don't feel good", "never feels right" all count as NEGATIVE signals.
4. Soft negativity IS negativity. These words signal a negative entry: drained, unmotivated, off, exhausted, heavy, numb, uneasy, irritable, tense, overwhelmed, blah, stuck, disconnected, restless, foggy, hollow, burned out, can't focus, on edge.
5. Mixed entries: If the afternoon was stressful after a good morning, the stress is the dominant signal — classify as "Negative", not "Neutral".

Score guidance:
- +0.7 to +1.0 → "Extremely Positive" (elated, overjoyed, deeply grateful)
- +0.1 to +0.7 → "Positive" (content, hopeful, pleased, proud)
- -0.1 to +0.1 → "Neutral" (routine, unremarkable, balanced — no emotional peaks)
- -0.7 to -0.1 → "Negative" (stressed, anxious, sad, frustrated, drained, overwhelmed)
- -1.0 to -0.7 → "Extremely Negative" (devastated, hopeless, miserable, in crisis)

Negative language includes (but is not limited to): sad, worried, frustrated, tired, stressed, anxious, disappointed, difficult, struggling, drained, unmotivated, exhausted, overwhelmed, upset, angry, irritable, hopeless, hollow, numb, heavy, tense, uneasy, off, blah, stuck, restless, foggy, burned out, hate, nothing feels right, can't, don't, not good, wasn't happy, never feels, on edge, falling apart.`

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

    const insightsSystemPrompt = `You are a personal growth and reflection assistant. Analyze this journal entry and generate meaningful insights about the person's thoughts, behaviors, and patterns. For each insight return:
- content: a thoughtful, personalized observation or piece of advice (2-3 sentences)
- insight_type: one of "pattern", "reflection", "advice", "growth", "warning"

Return ONLY a valid JSON object in this format with no markdown fences:
{ "insights": [ { "content": "...", "insight_type": "..." } ] }`

    console.log('[process-recording] Sending 4 parallel OpenAI Responses API calls (journal, mood, ideas, insights)')
    const [journalText, moodText, ideasText, insightsText] = await Promise.all([
      callOpenAIResponses({ model: 'gpt-4o', temperature: 0.7, apiKey: openAiKey, input: [{ role: 'system', content: 'Transform the transcript into JSON with keys title and entry.' }, { role: 'user', content: transcript }] }),
      callOpenAIResponses({ model: 'gpt-4o', temperature: 0.3, apiKey: openAiKey, input: [{ role: 'system', content: moodSystemPrompt }, { role: 'user', content: transcript }] }),
      callOpenAIResponses({ model: 'gpt-4o', temperature: 0.4, apiKey: openAiKey, input: [{ role: 'system', content: ideasSystemPrompt }, { role: 'user', content: transcript }] }),
      callOpenAIResponses({ model: 'gpt-4o', temperature: 0.4, apiKey: openAiKey, input: [{ role: 'system', content: insightsSystemPrompt }, { role: 'user', content: transcript }] }),
    ])
    console.log('[process-recording] OpenAI responses received', {
      journalTextLength: journalText.length,
      moodTextLength: moodText.length,
      moodTextPreview: moodText.slice(0, 300),
      ideasTextLength: ideasText.length,
      insightsTextLength: insightsText.length,
      ideasTextPreview: ideasText.slice(0, 300),
    })
    // Log the full raw mood/ideas/insights responses so we can inspect exactly what OpenAI returned
    console.log('[process-recording] Raw moodText from OpenAI:', moodText)
    console.log('[process-recording] Raw ideas response from OpenAI:', ideasText)
    console.log('[process-recording] Raw insights response from OpenAI:', insightsText)

    const safeParse = <T>(text: string, fallback: T, label?: string): T => {
      // Strip markdown code fences first
      const cleanedText = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()

      // Attempt 1: parse the cleaned text directly (the happy path)
      try {
        return JSON.parse(cleanedText) as T
      } catch {
        // Attempt 2: the model may have wrapped the JSON in prose despite being
        // told not to.  Extract the first {...} block and try again.
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            const extracted = JSON.parse(jsonMatch[0]) as T
            if (label) console.warn(`[process-recording] safeParse(${label}): used JSON-extraction fallback — model returned prose around JSON`)
            return extracted
          } catch {
            // fall through
          }
        }
        if (label) console.error(`[process-recording] safeParse(${label}): JSON parse failed entirely, using hardcoded fallback. Raw text (first 300): ${text.slice(0, 300)}`)
        return fallback
      }
    }

    const journalJson = safeParse<ParsedJournal>(journalText, { title: 'Untitled Entry', entry: transcript }, 'journal')
    const moodJson = safeParse<ParsedMood>(moodText, { mood_primary: 'reflective', mood_score: 0, mood_tags: ['reflective'], mood_level: 'Neutral' }, 'mood')
    console.log('[process-recording] Mood parse result', {
      mood_primary: moodJson.mood_primary,
      mood_score: moodJson.mood_score,
      mood_level: moodJson.mood_level,
      mood_reasoning: moodJson.mood_reasoning ?? '(none)',
      usedFallback: moodJson.mood_primary === 'reflective' && moodJson.mood_score === 0,
    })

    // Parse ideas with explicit error logging — strip markdown code fences in case OpenAI wraps the JSON
    let ideasJson: ParsedIdeas = { ideas: [] }
    try {
      const cleanedIdeasText = ideasText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      ideasJson = JSON.parse(cleanedIdeasText) as ParsedIdeas
      if (!Array.isArray(ideasJson.ideas)) {
        console.error('[process-recording] Parsed ideas JSON is missing the "ideas" array', { ideasJson })
        ideasJson = { ideas: [] }
      }
    } catch (parseErr) {
      console.error('[process-recording] Failed to parse ideas JSON', { error: String(parseErr), ideasText })
    }
    // Parse insights with fence stripping applied proactively
    let insightsJson: ParsedInsights = { insights: [] }
    try {
      const cleanedInsightsText = insightsText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      insightsJson = JSON.parse(cleanedInsightsText) as ParsedInsights
      if (!Array.isArray(insightsJson.insights)) {
        console.error('[process-recording] Parsed insights JSON is missing the "insights" array', { insightsJson })
        insightsJson = { insights: [] }
      }
    } catch (parseErr) {
      console.error('[process-recording] Failed to parse insights JSON', { error: String(parseErr), insightsText })
    }

    console.log('[process-recording] Parsed results', {
      journalTitle: journalJson.title,
      moodPrimary: moodJson.mood_primary,
      moodScore: moodJson.mood_score,
      moodLevel: moodJson.mood_level,
      moodReasoning: moodJson.mood_reasoning ?? '(none)',
      ideasCount: ideasJson.ideas.length,
      ideasPreview: ideasJson.ideas.slice(0, 2).map((i) => i.content),
      insightsCount: insightsJson.insights.length,
      insightsPreview: insightsJson.insights.slice(0, 2).map((i) => i.content),
    })

    // Ensure mood_level is always populated — derive from mood_score if the AI omitted it
    if (!moodJson.mood_level) {
      const s = moodJson.mood_score
      if (s >= 0.7) moodJson.mood_level = 'Extremely Positive'
      else if (s >= 0.1) moodJson.mood_level = 'Positive'
      else if (s >= -0.1) moodJson.mood_level = 'Neutral'
      else if (s >= -0.7) moodJson.mood_level = 'Negative'
      else moodJson.mood_level = 'Extremely Negative'
    }

    const recordedAt = new Date().toISOString()
    const durationSeconds = Math.max(1, Math.round(audio.size / 12000))

    console.log('[process-recording] Inserting journal entry')
    const { data: entry, error: entryErr } = await supabase
      .from('journal_entries')
      .insert({
        user_id: userId,
        audio_url: audioPath,
        raw_transcript: transcript,
        cleaned_entry: journalJson.entry,
        entry_title: journalJson.title,
        duration_seconds: durationSeconds,
        mood_primary: moodJson.mood_primary,
        mood_score: moodJson.mood_score,
        mood_tags: moodJson.mood_tags,
        mood_level: moodJson.mood_level,
        mood_reasoning: moodJson.mood_reasoning ?? null,
        themes: [],
        recorded_at: recordedAt,
        word_count: journalJson.entry.split(/\s+/).length,
      })
      .select('*')
      .single()

    if (entryErr || !entry) {
      console.error('[process-recording] Entry insert failed', { error: entryErr?.message ?? 'No row returned' })
      throw new Error('Failed to save journal entry.')
    }

    console.log('[process-recording] Inserting mood history', { entryId: entry.id })
    const { error: moodError } = await supabase.from('mood_history').insert({
      user_id: userId,
      entry_id: entry.id,
      mood_primary: moodJson.mood_primary,
      mood_score: moodJson.mood_score,
      mood_tags: moodJson.mood_tags,
      mood_level: moodJson.mood_level,
      mood_reasoning: moodJson.mood_reasoning ?? null,
      recorded_at: recordedAt,
    })
    if (moodError) {
      console.error('[process-recording] Mood insert failed', { error: moodError.message, entryId: entry.id })
      throw new Error('Failed to save mood history.')
    }

    const ideasToInsert = ideasJson.ideas.map((idea) => ({ user_id: userId, entry_id: entry.id, content: idea.content, category: idea.category, idea_type: idea.idea_type ?? 'other', details: idea.details ?? '' }))
    // Log the ideas array before inserting so we can confirm it's not empty and the shape is correct
    console.log('[process-recording] Ideas array before Supabase insert:', JSON.stringify(ideasToInsert))
    console.log('[process-recording] Inserting ideas', { count: ideasToInsert.length, entryId: entry.id })
    const { data: insertedIdeas, error: ideasError } = ideasToInsert.length
      ? await supabase.from('ideas').insert(ideasToInsert).select('id,content,category,idea_type,details')
      : { data: [], error: null }
    // Log the insert result to catch any silent failures (schema mismatch, RLS, etc.)
    console.log('[process-recording] Supabase ideas insert result', { insertedCount: insertedIdeas?.length ?? 0, error: ideasError?.message ?? null })

    if (ideasError) {
      console.error('[process-recording] Ideas insert failed', { error: ideasError.message, entryId: entry.id })
      throw new Error('Failed to save extracted ideas.')
    }

    const insightsToInsert = insightsJson.insights.map((insight) => ({
      user_id: userId,
      entry_id: entry.id,
      content: insight.content,
      insight_type: insight.insight_type ?? 'reflection',
    }))
    console.log('[process-recording] Insights array before Supabase insert:', JSON.stringify(insightsToInsert))
    console.log('[process-recording] Inserting insights', { count: insightsToInsert.length, entryId: entry.id })
    const { data: insertedInsights, error: insightsError } = insightsToInsert.length
      ? await supabase.from('insights').insert(insightsToInsert).select('id,content,insight_type')
      : { data: [], error: null }
    console.log('[process-recording] Supabase insights insert result', {
      insertedCount: insertedInsights?.length ?? 0,
      error: insightsError?.message ?? null,
      code: insightsError?.code ?? null,
      hint: insightsError?.hint ?? null,
    })

    if (insightsError) {
      console.error('[process-recording] Insights insert failed', {
        message: insightsError.message,
        code: insightsError.code,
        hint: insightsError.hint,
        entryId: entry.id,
      })
      // Non-fatal: log but don't throw so the entry is still returned
    }

    return new Response(JSON.stringify({
      id: entry.id,
      entry_title: entry.entry_title,
      cleaned_entry: entry.cleaned_entry,
      mood_primary: entry.mood_primary,
      mood_score: entry.mood_score,
      mood_tags: entry.mood_tags,
      mood_level: entry.mood_level,
      themes: entry.themes,
      ideas: insertedIdeas ?? [],
      insights: insertedInsights ?? [],
      duration_seconds: entry.duration_seconds,
      recorded_at: entry.recorded_at,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('[process-recording] Unhandled failure', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to process recording.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
