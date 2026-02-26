import { useEffect, useMemo, useState } from 'react'
import { ErrorState } from '../components/ErrorState'
import { FeatureGate } from '../components/FeatureGate'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { useUserPlan } from '../hooks/useUserPlan'
import { backfillIdeas } from '../lib/backfillIdeas'
import { supabase } from '../lib/supabase'
import type { Idea } from '../types'

const categories = ['all', 'business', 'creative', 'goal', 'action', 'other'] as const

const ideaTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
  business_idea: { label: 'Business Idea', color: '#6b4c9a', bg: '#ede6fa' },
  problem_solution: { label: 'Problem Solution', color: '#2d7d6f', bg: '#daf2ed' },
  concept: { label: 'Concept', color: '#8a6d3b', bg: '#f5edd6' },
  action_step: { label: 'Action Step', color: '#3d6b8a', bg: '#d9edf8' },
}

function getIdeaTypeStyle(ideaType?: string) {
  if (!ideaType || !ideaTypeConfig[ideaType]) return null
  return ideaTypeConfig[ideaType]
}

export function IdeasVaultPage() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof categories)[number]>('all')
  const [starredOnly, setStarredOnly] = useState(false)
  const [bouncingId, setBouncingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
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
    let q = supabase.from('ideas').select('*').order('created_at', { ascending: false }).limit(300)
    if (category !== 'all') q = q.eq('category', category)
    if (starredOnly) q = q.eq('is_starred', true)
    const { data, error: queryError } = await q
    if (queryError) {
      console.error('[IdeasVaultPage] Failed to load ideas:', queryError.message, queryError.code)
      setError('Unable to load ideas right now.')
    }
    else {
      setIdeas((data as Idea[]) ?? [])
      setError(null)
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [category, starredOnly])

  async function runBackfill() {
    setBackfilling(true)
    setBackfillResult(null)
    setError(null)
    try {
      const result = await backfillIdeas()
      setBackfillResult(result.message)
      if (result.created > 0) await load()
    } catch (err) {
      setError('Backfill failed: ' + (err instanceof Error ? err.message : String(err)))
    }
    setBackfilling(false)
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return ideas
    const lowered = query.toLowerCase()
    return ideas.filter((idea) => idea.content.toLowerCase().includes(lowered) || (idea.details ?? '').toLowerCase().includes(lowered))
  }, [ideas, query])

  async function toggleStar(idea: Idea) {
    if (!supabase) return
    setBouncingId(idea.id)
    const { error: updateError } = await supabase.from('ideas').update({ is_starred: !idea.is_starred }).eq('id', idea.id)
    if (updateError) setError('Could not update this idea. Please try again.')
    await load()
    window.setTimeout(() => setBouncingId(null), 260)
  }

  if (planLoading || loading) return <LoadingSkeleton lines={6} />
  if (planError) return <ErrorState message={planError} />

  return (
    <FeatureGate userPlan={plan} requiredPlan="core" featureName="Ideas Vault">
      <main className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="serif-reading text-3xl text-[#312b4e]">Ideas Vault</h2>
            <p className="mt-1 text-sm text-[#6c7386]">AI-extracted ideas from your journal entries — business concepts, solutions, and next steps.</p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="soft-pill shrink-0 whitespace-nowrap disabled:opacity-50"
            title="Reload ideas from Supabase"
          >
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>
        {error && <ErrorState message={error} onAction={() => void load()} actionLabel="Try again" />}
        <input className="app-card w-full px-4 py-3 text-sm outline-none" placeholder="Search ideas and details..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {categories.map((value) => (
            <button key={value} onClick={() => setCategory(value)} className={`soft-pill whitespace-nowrap capitalize ${category === value ? 'bg-[#e6e1fb] text-[#4a438b]' : ''}`}>
              {value}
            </button>
          ))}
          <button onClick={() => setStarredOnly((value) => !value)} className={`soft-pill whitespace-nowrap ${starredOnly ? 'bg-[#efe2ba] text-[#73561f]' : ''}`}>
            Starred only
          </button>
        </div>

        {backfillResult && (
          <div className="app-card p-3 text-sm text-[#2d7d6f]">{backfillResult}</div>
        )}

        {filtered.length === 0 && !loading && (
          <div className="app-card space-y-3 p-5 text-center">
            <p className="text-[#6b7386]">
              {query || starredOnly || category !== 'all'
                ? 'No ideas match your current filters.'
                : 'No ideas yet — record a journal entry to get started.'}
            </p>
            {!query && !starredOnly && category === 'all' && (
              <div className="space-y-2">
                <p className="text-xs text-[#9196a6]">Already have journal entries? Use the button below to extract ideas from them.</p>
                <button
                  onClick={() => void runBackfill()}
                  disabled={backfilling}
                  className="premium-button disabled:opacity-50"
                >
                  {backfilling ? 'Generating ideas…' : 'Generate ideas from existing entries'}
                </button>
              </div>
            )}
          </div>
        )}

        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((idea) => {
            const typeStyle = getIdeaTypeStyle(idea.idea_type)
            const isExpanded = expandedId === idea.id
            return (
              <li key={idea.id} className="app-card overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {typeStyle && (
                        <span className="mb-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: typeStyle.color, backgroundColor: typeStyle.bg }}>
                          {typeStyle.label}
                        </span>
                      )}
                      <p className="text-sm font-medium leading-relaxed text-[#3d4254]">{idea.content}</p>
                      <p className="mt-2 text-xs uppercase tracking-wide text-[#7c8296]">{idea.category}</p>
                    </div>
                    <button onClick={() => void toggleStar(idea)} className="shrink-0 rounded-full bg-[#f3efe8] px-3 py-1 text-sm text-[#5e6380]" style={{ animation: bouncingId === idea.id ? 'bounce-star 220ms ease-in-out' : undefined }}>
                      {idea.is_starred ? '★' : '☆'}
                    </button>
                  </div>

                  {idea.details && (
                    <>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : idea.id)}
                        className="mt-2 text-xs font-medium text-[#6b5fb5] hover:text-[#4a3f8f]"
                      >
                        {isExpanded ? 'Hide details' : 'Show details'}
                      </button>
                      {isExpanded && (
                        <div className="mt-2 rounded-xl bg-[#f9f6ff] p-3">
                          <p className="text-sm leading-relaxed text-[#4a4e5a]">{idea.details}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </main>
    </FeatureGate>
  )
}
