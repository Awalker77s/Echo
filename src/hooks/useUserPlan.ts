import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Plan } from '../types'

export function useUserPlan() {
  const [plan, setPlan] = useState<Plan>('free')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPlan = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured.')
      setLoading(false)
      return
    }

    setLoading(true)
    // maybeSingle avoids a PGRST116 error when the profile row hasn't been
    // created yet (e.g. the auth trigger hasn't fired). Fall back to 'free'.
    const { data, error: profileError } = await supabase.from('users').select('plan').maybeSingle()
    if (profileError) {
      console.error('[useUserPlan] Failed to load plan:', profileError.message, profileError.code)
      setError('We could not load your subscription plan.')
      setLoading(false)
      return
    }

    setPlan((data?.plan as Plan) ?? 'free')
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => { void loadPlan() }, [loadPlan])

  return { plan, loading, error, reloadPlan: loadPlan }
}
