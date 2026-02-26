import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

async function ensureUserProfile(session: Session | null) {
  if (!supabase || !session?.user) return

  const userId = session.user.id
  const email = session.user.email ?? null

  const { data, error } = await supabase.from('users').select('id').eq('id', userId).maybeSingle()
  if (error) {
    console.error('[auth] Failed to check user profile row', error)
    return
  }

  if (!data) {
    const { error: insertError } = await supabase.from('users').insert({
      id: userId,
      email,
      plan: 'free',
      recording_count: 0,
    })

    if (insertError) {
      console.error('[auth] Failed to create fallback user profile row', insertError)
    }
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await ensureUserProfile(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession)
      void ensureUserProfile(nextSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return { session, loading, isAuthed: Boolean(session) }
}
