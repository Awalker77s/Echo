import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
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

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) throw new Error('Unauthorized')

    const userId = userData.user.id

    const [entries, ideas, moods, patterns, chapters] = await Promise.all([
      supabase.from('journal_entries').select('*').eq('user_id', userId).order('recorded_at', { ascending: false }),
      supabase.from('ideas').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('mood_history').select('*').eq('user_id', userId).order('recorded_at', { ascending: false }),
      supabase.from('patterns').select('*').eq('user_id', userId).order('surfaced_at', { ascending: false }),
      supabase.from('chapter_reports').select('*').eq('user_id', userId).order('month', { ascending: false }),
    ])

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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
