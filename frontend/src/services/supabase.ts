import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://example.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'public-anon-key'

export const supabase = createClient(url, key)
