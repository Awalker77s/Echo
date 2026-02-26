import { createClient } from '@supabase/supabase-js'
import { env, hasSupabaseEnv } from './env'

if (!hasSupabaseEnv) {
  console.warn(
    '[supabase] Client not initialized — environment variables are missing. All Supabase API calls will be skipped.',
  )
}

export const supabase = hasSupabaseEnv
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null
