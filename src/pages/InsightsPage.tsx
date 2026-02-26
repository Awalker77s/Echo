import { useEffect, useState } from 'react'
import { ErrorState } from '../components/ErrorState'
import { FeatureGate } from '../components/FeatureGate'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { useUserPlan } from '../hooks/useUserPlan'
import { backfillInsights } from '../lib/backfillInsights'
import { supabase } from '../lib/supabase'
import type { Insight } from '../types'

const insightTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
  pattern: { label: 'Pattern', color: '#6b4c9a', bg: '#ede6fa' },
  reflection: { label: 'Reflection', color: '#2d7d6f', bg: '#daf2ed' },
  advice: { label: 'Advice', color: '#3d6b8a', bg: '#d9edf8' },
  growth: { label: 'Growth', color: '#3a6b3a', bg: '#d9f0d9' },
  warning: { label: 'Warning', color: '#8a4a2d', bg: '#f8e2d9' },
}

function getInsightTypeStyle(insightType?: string) {
  if (!insightType || !insightTypeConfig[insightType]) return null
  return insightTypeConfig[insightType]
}

export function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillResult, setBackfillResult] = useState<string | null>(null)
  const { plan, loading: planLoading, error: planError } = useUserPlan()

  async function load() {
    if (!supabase) {
      setError('Supabase is not configured.')
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('insights')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
    if (queryError) {
      console.error('[InsightsPage] Failed to load insights:', queryError.message, queryError.code)
      setError('Unable to load insights right now.')
    } else {
      setInsights((data as Insight[]) ?? [])
      setError(null)
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function runBackfill() {
    setBackfilling(true)
    setBackfillResult(null)
    setError(null)
    try {
      const result = await backfillInsights()
      setBackfillResult(result.message)
      if (result.created > 0) await load()
    } catch (err) {
      setError('Generation failed: ' + (err instanceof Error ? err.message : String(err)))
    }
    setBackfilling(false)
  }

  if (planLoading || loading) return <LoadingSkeleton lines={5} />
  if (planError) return <ErrorState message={planError} />

  return (
    <FeatureGate userPlan={plan} requiredPlan="memoir" featureName="Insights">
      <main className="space-y-4 dark:text-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="serif-reading text-3xl text-[#302a4c] dark:text-gray-100">Insights</h2>
            <p className="mt-1 text-sm text-[#6c7386] dark:text-slate-300">Thoughtful observations and personal growth insights drawn from your journal entries.</p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="soft-pill shrink-0 whitespace-nowrap disabled:opacity-50"
            title="Reload insights from Supabase"
          >
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>

        {error && <ErrorState message={error} onAction={() => void load()} actionLabel="Try again" />}

        {backfillResult && (
          <div className="app-card p-3 text-sm text-[#2d7d6f]">{backfillResult}</div>
        )}

        {insights.length === 0 && !loading && (
          <div className="app-card space-y-3 p-5 text-center">
            <p className="text-[#6b7386]">No insights yet — record a journal entry to get started.</p>
            <div className="space-y-2">
              <p className="text-xs text-[#9196a6]">Already have journal entries? Use the button below to generate insights from them.</p>
              <button
                onClick={() => void runBackfill()}
                disabled={backfilling}
                className="premium-button disabled:opacity-50"
              >
                {backfilling ? 'Generating insights…' : 'Generate insights from existing entries'}
              </button>
            </div>
          </div>
        )}

        {insights.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={() => void runBackfill()}
              disabled={backfilling}
              className="soft-pill whitespace-nowrap disabled:opacity-50"
            >
              {backfilling ? 'Generating…' : '✦ Generate new insights'}
            </button>
          </div>
        )}

        <ul className="space-y-4 dark:text-gray-100">
          {insights.map((insight) => {
            const typeStyle = getInsightTypeStyle(insight.insight_type)
            return (
              <li key={insight.id} className="app-card overflow-hidden bg-gradient-to-br from-[#efeaff] to-[#fff7ef]">
                <div className="p-5">
                  {typeStyle && (
                    <span
                      className="mb-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                      style={{ color: typeStyle.color, backgroundColor: typeStyle.bg }}
                    >
                      {typeStyle.label}
                    </span>
                  )}
                  <p className="text-sm leading-relaxed text-[#3d3660]">{insight.content}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </main>
    </FeatureGate>
  )
}
