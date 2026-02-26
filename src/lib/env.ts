export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  openAiKey: import.meta.env.VITE_OPENAI_API_KEY ?? '',
}

export const hasSupabaseEnv = Boolean(env.supabaseUrl && env.supabaseAnonKey)

if (!hasSupabaseEnv) {
  console.error(
    '[Echo] Supabase environment variables are missing or empty. ' +
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a .env file in the project root. ' +
      'See .env.example for reference.',
  )
}
