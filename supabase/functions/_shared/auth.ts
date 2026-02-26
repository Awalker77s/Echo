import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export async function createAuthedClient(req: Request) {
  const authorization = req.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()

  console.log('[auth] Starting auth check', {
    hasAuthorizationHeader: Boolean(authorization),
    hasBearerPrefix: authorization.toLowerCase().startsWith('bearer '),
    tokenLength: token.length,
  })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  )

  if (!token) {
    console.log('[auth] Missing bearer token')
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase.auth.getUser(token)

  console.log('[auth] Auth check result', {
    hasUser: Boolean(data?.user),
    error: error?.message ?? null,
  })

  if (error || !data.user) throw new Error('Unauthorized')

  return { supabase, user: data.user }
}
