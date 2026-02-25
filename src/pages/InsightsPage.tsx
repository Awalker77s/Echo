import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState } from '../components/ErrorState'
import { FeatureGate } from '../components/FeatureGate'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { useUserPlan } from '../hooks/useUserPlan'
import { supabase } from '../lib/supabase'
import type { PatternInsight } from '../types'

export function InsightsPage() {
  const [patterns, setPatterns] = useState<PatternInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { plan, loading: planLoading, error: planError } = useUserPlan()

  async function loadPatterns() {
    if (!supabase) {
      setError('Supabase is not configured.')
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: queryError } = await supabase.from('patterns').select('*').eq('dismissed', false).order('confidence', { ascending: false })
    if (queryError) setError('Unable to load insights right now.')
    else {
      setPatterns((data as PatternInsight[]) ?? [])
      setError(null)
    }
    setLoading(false)
  }

  useEffect(() => { void loadPatterns() }, [])

  async function dismissPattern(id: string) {
    if (!supabase) return
    const { error: dismissError } = await supabase.from('patterns').update({ dismissed: true }).eq('id', id)
    if (dismissError) {
      setError('Could not dismiss insight. Please try again.')
      return
    }
    setPatterns((current) => current.filter((pattern) => pattern.id !== id))
  }

  if (planLoading || loading) return <LoadingSkeleton lines={5} />
  if (planError) return <ErrorState message={planError} />

  return (
    <FeatureGate userPlan={plan} requiredPlan="memoir" featureName="Insights">
      <main className="space-y-4">
        <h2 className="serif-reading text-3xl text-[#302a4c]">Gentle insights</h2>
        <p className="text-sm text-[#6c7386]">Here’s what seems to be recurring in your recent reflections.</p>
        {error && <ErrorState message={error} onAction={() => void loadPatterns()} actionLabel="Try again" />}

        {patterns.length === 0 && <div className="app-card p-4 text-[#6b7386]">No active insights yet. Keep journaling to uncover patterns.</div>}

        <div className="space-y-4">
          {patterns.map((pattern) => {
            const strength = Math.max(8, Math.round((pattern.confidence ?? 0.1) * 100))
            return (
              <article key={pattern.id} className="app-card bg-gradient-to-br from-[#efeaff] to-[#fff7ef] p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7c7f96]">{pattern.pattern_type.replace(/_/g, ' ')}</p>
                <h3 className="mt-2 text-lg font-semibold text-[#2f3350]">{pattern.description}</h3>
                <div className="mt-3 h-2 rounded-full bg-white/80"><div className="h-full rounded-full bg-[#7d74d2]" style={{ width: `${strength}%` }} /></div>
                <p className="mt-2 text-xs text-[#757b90]">Confidence appears {strength > 66 ? 'strong' : strength > 33 ? 'moderate' : 'gentle'}.</p>
                <div className="mt-3 space-y-2 text-sm text-[#5f667a]">
                  {pattern.evidence?.map((item, index) => (
                    <div key={`${pattern.id}-${index}`} className="rounded-2xl bg-white/65 p-3">
                      <Link className="font-medium text-[#4b438f] underline" to={`/entries/${item.entry_id}`}>Show Me</Link>
                      <p className="mt-1 italic">“{item.quote}”</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => void dismissPattern(pattern.id)} className="soft-pill mt-3">Dismiss insight</button>
              </article>
            )
          })}
        </div>
      </main>
    </FeatureGate>
  )
}
