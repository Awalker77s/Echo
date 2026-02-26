import { env } from './env'
import { supabase } from './supabase'

interface InvokeOptions {
  body?: BodyInit | Record<string, unknown> | null
}

export async function invokeEdgeFunction<T>(name: string, options: InvokeOptions = {}) {
  if (!supabase) {
    return { data: null as T | null, error: new Error('Supabase is not configured.') }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token

  if (!accessToken) {
    return { data: null as T | null, error: new Error('You must be logged in to call this endpoint.') }
  }

  return supabase.functions.invoke<T>(name, {
    body: options.body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: env.supabaseAnonKey,
    },
  })
}
