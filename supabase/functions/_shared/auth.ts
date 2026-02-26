import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export async function createAuthedClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[auth] Missing Supabase env', {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    })
    throw new Error('Server is missing Supabase configuration.')
  }

  const authorization = req.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()

  console.log('[auth] Starting auth check', {
    hasAuthorizationHeader: Boolean(authorization),
    hasBearerPrefix: authorization.toLowerCase().startsWith('bearer '),
    tokenLength: token.length,
  })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authorization } },
  })

  if (!token) {
    console.error('[auth] Missing bearer token')
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase.auth.getUser(token)

  console.log('[auth] Auth check result', {
    hasUser: Boolean(data?.user),
    error: error?.message ?? null,
  })

  if (error || !data.user) {
    console.error('[auth] Failed auth check', { error: error?.message ?? 'No user returned' })
    throw new Error('Unauthorized')
  }

  return { supabase, user: data.user }
}
