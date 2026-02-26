import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callOpenAIResponses, callWhisperTranscription } from '../_shared/openai.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface ParsedJournal { title: string; entry: string }
interface ParsedMood { mood_primary: string; mood_score: number; mood_tags: string[] }
interface ParsedIdeas { ideas: Array<{ content: string; category: string }> }

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

    console.log('[process-recording] Calling OpenAI journal/mood/idea prompts')
    const [journalText, moodText, ideasText] = await Promise.all([
      callOpenAIResponses({ model: 'gpt-4o', temperature: 0.7, apiKey: openAiKey, input: [{ role: 'system', content: 'Transform the transcript into JSON with keys title and entry.' }, { role: 'user', content: transcript }] }),
      callOpenAIResponses({ model: 'gpt-4o', temperature: 0.3, apiKey: openAiKey, input: [{ role: 'system', content: 'Analyze mood and return JSON with mood_primary, mood_score, mood_tags.' }, { role: 'user', content: transcript }] }),
      callOpenAIResponses({ model: 'gpt-4o', temperature: 0.3, apiKey: openAiKey, input: [{ role: 'system', content: 'Extract ideas and return JSON with an ideas array containing content and category.' }, { role: 'user', content: transcript }] }),
    ])

    const safeParse = <T>(text: string, fallback: T): T => {
      try {
        return JSON.parse(text) as T
      } catch {
        return fallback
      }
    }

    const journalJson = safeParse<ParsedJournal>(journalText, { title: 'Untitled Entry', entry: transcript })
    const moodJson = safeParse<ParsedMood>(moodText, { mood_primary: 'reflective', mood_score: 0, mood_tags: ['reflective'] })
    const ideasJson = safeParse<ParsedIdeas>(ideasText, { ideas: [] })

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
      recorded_at: recordedAt,
    })
    if (moodError) {
      console.error('[process-recording] Mood insert failed', { error: moodError.message, entryId: entry.id })
      throw new Error('Failed to save mood history.')
    }

    const ideasToInsert = ideasJson.ideas.map((idea) => ({ user_id: userId, entry_id: entry.id, content: idea.content, category: idea.category }))
    console.log('[process-recording] Inserting ideas', { count: ideasToInsert.length, entryId: entry.id })
    const { data: insertedIdeas, error: ideasError } = ideasToInsert.length
      ? await supabase.from('ideas').insert(ideasToInsert).select('id,content,category')
      : { data: [], error: null }

    if (ideasError) {
      console.error('[process-recording] Ideas insert failed', { error: ideasError.message, entryId: entry.id })
      throw new Error('Failed to save extracted ideas.')
    }

    return new Response(JSON.stringify({
      id: entry.id,
      entry_title: entry.entry_title,
      cleaned_entry: entry.cleaned_entry,
      mood_primary: entry.mood_primary,
      mood_score: entry.mood_score,
      mood_tags: entry.mood_tags,
      themes: entry.themes,
      ideas: insertedIdeas ?? [],
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
