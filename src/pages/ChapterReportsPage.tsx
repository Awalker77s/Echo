import { useEffect, useMemo, useState } from 'react'
import { ErrorState } from '../components/ErrorState'
import { FeatureGate } from '../components/FeatureGate'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { useUserPlan } from '../hooks/useUserPlan'
import { supabase } from '../lib/supabase'
import type { ChapterReport } from '../types'

export function ChapterReportsPage() {
  const [reports, setReports] = useState<ChapterReport[]>([])
  const [selected, setSelected] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { plan, loading: planLoading, error: planError } = useUserPlan()

  async function loadReports() {
    if (!supabase) {
      setError('Supabase is not configured.')
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: queryError } = await supabase.from('chapter_reports').select('*').order('month', { ascending: false })
    if (queryError) setError('Unable to load chapter reports right now.')
    else {
      const rows = (data as ChapterReport[]) ?? []
      setReports(rows)
      if (rows[0]) setSelected((current) => current || rows[0].id)
      setError(null)
    }
    setLoading(false)
  }

  useEffect(() => { void loadReports() }, [])

  const activeReport = useMemo(() => reports.find((report) => report.id === selected) ?? null, [reports, selected])

  async function shareReport() {
    if (!activeReport) return
    const text = `${activeReport.title}\n\n${activeReport.narrative.slice(0, 300)}...`
    if (navigator.share) {
      await navigator.share({ title: activeReport.title, text })
      return
    }
    await navigator.clipboard.writeText(text)
  }

  const moodSummary = activeReport?.mood_summary as { overall?: string; arc?: string; highlights?: string[] } | null
  const growthMoments = activeReport?.growth_moments as Array<{ moment?: string; significance?: string } | string> | null

  if (planLoading || loading) return <LoadingSkeleton lines={6} />
  if (planError) return <ErrorState message={planError} />

  return (
    <FeatureGate userPlan={plan} requiredPlan="memoir" featureName="Chapter Reports">
      <main className="space-y-4">
        <div>
          <h2 className="serif-reading text-3xl text-[#302b4b]">Chapter Reports</h2>
          <p className="mt-1 text-sm text-[#6c7386]">Your life story, one month at a time — woven from your journal entries.</p>
        </div>
        {error && <ErrorState message={error} onAction={() => void loadReports()} actionLabel="Try again" />}

        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {reports.map((report) => (
            <button key={report.id} onClick={() => setSelected(report.id)} className={`min-w-52 rounded-3xl p-4 text-left ${report.id === selected ? 'bg-[#e8e2ff] text-[#413987]' : 'app-card text-[#5f667a]'}`}>
              <p className="text-xs uppercase tracking-[0.14em]">{new Date(report.month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
              <p className="serif-reading mt-2 text-lg">{report.title}</p>
              {report.entry_count > 0 && <p className="mt-1 text-xs text-[#8a859a]">{report.entry_count} entries</p>}
            </button>
          ))}
        </div>

        <section className="app-card bg-gradient-to-b from-[#fff8f2] to-[#f8f1ea] p-6 md:p-10">
          {!activeReport ? (
            <p className="text-[#6a7284]">No chapters yet. Generate your first month to begin your memoir.</p>
          ) : (
            <article className="space-y-6 text-[#2f2a3e]">
              <header className="serif-reading">
                <p className="text-xs uppercase tracking-[0.16em] text-[#82788e]">{new Date(activeReport.month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
                <h3 className="mt-2 text-4xl">{activeReport.title}</h3>
              </header>

              {/* Narrative paragraphs */}
              <div className="serif-reading space-y-5">
                {activeReport.narrative.split('\n').filter(Boolean).map((paragraph, index) => (
                  <p key={index} className="indent-6 text-lg leading-[1.9]">{paragraph}</p>
                ))}
              </div>

              {/* Themes */}
              {activeReport.top_themes?.length > 0 && (
                <div className="rounded-2xl bg-white/50 p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[#7c7f96]">Themes of the month</p>
                  <div className="flex flex-wrap gap-2">
                    {activeReport.top_themes.map((theme, index) => (
                      <span key={index} className="rounded-full bg-[#ede6fa] px-3 py-1 text-sm text-[#5b4f9a]">{theme}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mood Summary */}
              {moodSummary && (moodSummary.overall || moodSummary.arc) && (
                <div className="rounded-2xl bg-gradient-to-r from-[#f0edff] to-[#fef8f0] p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[#7d74d2]">Emotional landscape</p>
                  {moodSummary.overall && (
                    <p className="text-sm text-[#3d3660]"><span className="font-medium">Overall tone:</span> {moodSummary.overall}</p>
                  )}
                  {moodSummary.arc && (
                    <p className="mt-1 text-sm text-[#3d3660]"><span className="font-medium">Emotional arc:</span> {moodSummary.arc}</p>
                  )}
                  {moodSummary.highlights && moodSummary.highlights.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-[#6b65a3]">Notable moments:</p>
                      <ul className="mt-1 space-y-1">
                        {moodSummary.highlights.map((highlight, index) => (
                          <li key={index} className="text-sm text-[#4a4e5a]">&bull; {highlight}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Growth Moments */}
              {growthMoments && growthMoments.length > 0 && (
                <div className="rounded-2xl bg-[#eef8f0] p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-[#3d7a52]">Growth moments</p>
                  <div className="space-y-3">
                    {growthMoments.map((item, index) => {
                      const isString = typeof item === 'string'
                      return (
                        <div key={index} className="rounded-xl bg-white/60 p-3">
                          <p className="text-sm font-medium text-[#2d5a3e]">{isString ? item : item.moment ?? ''}</p>
                          {!isString && item.significance && (
                            <p className="mt-1 text-xs text-[#5a7a66]">{item.significance}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={() => void shareReport()} className="premium-button">Share</button>
                <button onClick={() => window.print()} className="soft-pill">Print</button>
              </div>
            </article>
          )}
        </section>
      </main>
    </FeatureGate>
  )
}
