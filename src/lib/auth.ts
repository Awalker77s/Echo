import { supabase } from './supabase'

export async function signUp(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase.auth.signUp({ email, password })
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase.auth.signInWithOAuth({ provider: 'google' })
}

export async function signOut() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase.auth.signOut()
}
