import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import OpenAI from 'https://esm.sh/openai@4.86.1'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) throw new Error('Unauthorized')

    const userId = userData.user.id
    const { data: profile } = await supabase.from('users').select('plan').eq('id', userId).single()
    const plan = profile?.plan ?? 'free'

    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const { count: monthCount } = await supabase
      .from('journal_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('recorded_at', monthStart)

    if (plan === 'free' && (monthCount ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: 'Free tier monthly recording limit reached' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const formData = await req.formData()
    const audio = formData.get('audio')
    if (!(audio instanceof File)) throw new Error('Missing audio file')

    const audioPath = `${userId}/${crypto.randomUUID()}.webm`
    const { error: uploadError } = await supabase.storage.from('journal-audio').upload(audioPath, audio, {
      contentType: audio.type || 'audio/webm',
      upsert: false,
    })
    if (uploadError) throw uploadError

    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') })

    const whisper = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audio,
    })
    const transcript = whisper.text

    const journalPrompt = `Transform raw speech transcription into a clean, personal journal entry. Preserve the speaker's voice, personality, and specific details. Remove filler words and repetition. Keep first-person. Do not add facts. Return JSON {\"title\": string, \"entry\": string}.`
    const moodPrompt = `Analyze transcript mood using one of: happy, excited, grateful, calm, reflective, neutral, anxious, stressed, frustrated, sad, angry, confused, hopeful, nostalgic, determined. Return JSON {\"mood_primary\": string, \"mood_score\": number, \"mood_tags\": string[]}.`
    const ideasPrompt = `Extract genuine ideas and categorize as business|creative|goal|action|other. Return JSON {\"ideas\": [{\"content\": string, \"category\": string}]}.`

    const [journalRes, moodRes, ideasRes] = await Promise.all([
      openai.responses.create({ model: 'gpt-4o', temperature: 0.7, input: [{ role: 'system', content: journalPrompt }, { role: 'user', content: transcript }] }),
      openai.responses.create({ model: 'gpt-4o', temperature: 0.3, input: [{ role: 'system', content: moodPrompt }, { role: 'user', content: transcript }] }),
      openai.responses.create({ model: 'gpt-4o', temperature: 0.3, input: [{ role: 'system', content: ideasPrompt }, { role: 'user', content: transcript }] }),
    ])

    const safeParse = <T>(text: string, fallback: T): T => {
      try {
        return JSON.parse(text) as T
      } catch {
        return fallback
      }
    }

    const journalJson = safeParse<{ title: string; entry: string }>(journalRes.output_text, {
      title: 'Untitled Entry',
      entry: transcript,
    })
    const moodJson = safeParse<{ mood_primary: string; mood_score: number; mood_tags: string[] }>(moodRes.output_text, {
      mood_primary: 'reflective',
      mood_score: 0,
      mood_tags: ['reflective'],
    })
    const ideasJson = safeParse<{ ideas: { content: string; category: string }[] }>(ideasRes.output_text, { ideas: [] })

    const recordedAt = new Date().toISOString()
    const durationSeconds = Math.max(1, Math.round((audio.size / 12000)))

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

    if (entryErr || !entry) throw entryErr

    await supabase.from('mood_history').insert({
      user_id: userId,
      entry_id: entry.id,
      mood_primary: moodJson.mood_primary,
      mood_score: moodJson.mood_score,
      mood_tags: moodJson.mood_tags,
      recorded_at: recordedAt,
    })

    const ideasToInsert = ideasJson.ideas.map((idea) => ({
      user_id: userId,
      entry_id: entry.id,
      content: idea.content,
      category: idea.category,
    }))

    const { data: insertedIdeas } = ideasToInsert.length
      ? await supabase.from('ideas').insert(ideasToInsert).select('id,content,category')
      : { data: [] }

    return new Response(
      JSON.stringify({
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
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
