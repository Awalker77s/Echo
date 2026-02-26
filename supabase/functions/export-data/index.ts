import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { createAuthedClient } from '../_shared/auth.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { supabase, user } = await createAuthedClient(req)

    const userId = user.id

    const [entries, ideas, moods, patterns, chapters] = await Promise.all([
      supabase.from('journal_entries').select('*').eq('user_id', userId).order('recorded_at', { ascending: false }),
      supabase.from('ideas').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('mood_history').select('*').eq('user_id', userId).order('recorded_at', { ascending: false }),
      supabase.from('patterns').select('*').eq('user_id', userId).order('surfaced_at', { ascending: false }),
      supabase.from('chapter_reports').select('*').eq('user_id', userId).order('month', { ascending: false }),
    ])

    const anyError = entries.error || ideas.error || moods.error || patterns.error || chapters.error
    if (anyError) throw new Error('Failed to gather all data for export.')

    return new Response(JSON.stringify({
      exported_at: new Date().toISOString(),
      user_id: userId,
      entries: entries.data ?? [],
      ideas: ideas.data ?? [],
      mood_history: moods.data ?? [],
      patterns: patterns.data ?? [],
      chapter_reports: chapters.data ?? [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[export-data] Unhandled failure', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Request failed. Please try again.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
