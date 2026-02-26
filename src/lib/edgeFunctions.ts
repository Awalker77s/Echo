import { env } from './env'
import { supabase } from './supabase'

interface InvokeOptions {
  body?: BodyInit | Record<string, unknown> | null
}

export async function invokeEdgeFunction<T>(name: string, options: InvokeOptions = {}) {
  if (!supabase) {
    const err = new Error('Supabase is not configured. Check your .env file.')
    console.error(`[edgeFunction:${name}]`, err.message)
    return { data: null as T | null, error: err }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token

  if (!accessToken) {
    const err = new Error('You must be logged in to call this endpoint.')
    console.error(`[edgeFunction:${name}]`, err.message)
    return { data: null as T | null, error: err }
  }

  const result = await supabase.functions.invoke<T>(name, {
    body: options.body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: env.supabaseAnonKey,
    },
  })

  if (result.error) {
    console.error(`[edgeFunction:${name}] Failed:`, result.error.message)
  }

  return result
}
