import { useEffect, useMemo, useState } from 'react'
import { ErrorState } from '../components/ErrorState'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { supabase } from '../lib/supabase'
import { invokeEdgeFunction } from '../lib/edgeFunctions'
import type { MoodPoint, Plan } from '../types'

function downloadFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function SettingsPage() {
  const [plan, setPlan] = useState<Plan>('free')
  const [moods, setMoods] = useState<MoodPoint[]>([])
  const [busy, setBusy] = useState(false)
  const [weeklyEmail, setWeeklyEmail] = useState(true)
  const [insightNudges, setInsightNudges] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    if (!supabase) {
      setError('Supabase is not configured.')
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data: profile, error: profileError }, { data: moodData, error: moodError }] = await Promise.all([
      supabase.from('users').select('plan').maybeSingle(),
      supabase.from('mood_history').select('id,recorded_at,mood_score,mood_primary').order('recorded_at', { ascending: false }).limit(30),
    ])

    if (profileError || moodError) {
      if (profileError) console.error('[SettingsPage] Failed to load profile:', profileError.message, profileError.code)
      if (moodError) console.error('[SettingsPage] Failed to load mood history:', moodError.message, moodError.code)
      setError('Unable to load settings right now.')
    }
    else {
      if (profile?.plan) setPlan(profile.plan as Plan)
      setMoods((moodData as MoodPoint[]) ?? [])
      setError(null)
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const moodSummary = useMemo(() => {
    if (!moods.length) return { average: 0, dominant: 'neutral', count: 0 }
    const average = moods.reduce((sum, mood) => sum + Number(mood.mood_score ?? 0), 0) / moods.length
    const counts = moods.reduce<Record<string, number>>((acc, mood) => {
      acc[mood.mood_primary] = (acc[mood.mood_primary] ?? 0) + 1
      return acc
    }, {})
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral'
    return { average, dominant, count: moods.length }
  }, [moods])

  async function exportJson() {
    if (!supabase) return
    setBusy(true)
    setMessage(null)
    const { data, error: exportError } = await invokeEdgeFunction<Record<string, unknown>>('export-data')
    setBusy(false)
    if (exportError) {
      setError(exportError.message)
      return
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    downloadFile(`echo-export-${new Date().toISOString().slice(0, 10)}.json`, blob)
    setMessage('Your export is ready and has been downloaded.')
  }

  function downloadMoodCard() {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 630
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setError('Unable to generate mood summary card in this browser.')
      return
    }

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#ede6ff')
    gradient.addColorStop(1, '#f6eee4')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#332f4f'
    ctx.font = 'bold 58px Inter'
    ctx.fillText('Echo Mood Snapshot', 80, 120)
    ctx.font = '34px Inter'
    ctx.fillStyle = '#626a81'
    ctx.fillText(`Entries: ${moodSummary.count}`, 80, 220)
    ctx.fillText(`Dominant mood: ${moodSummary.dominant}`, 80, 278)
    ctx.fillText(`Average score: ${moodSummary.average.toFixed(2)}`, 80, 336)

    ctx.fillStyle = '#7b74d4'
    ctx.fillRect(80, 430, Math.max(120, ((moodSummary.average + 1) / 2) * 900), 50)

    canvas.toBlob((blob) => {
      if (!blob) return
      downloadFile(`echo-mood-summary-${new Date().toISOString().slice(0, 10)}.png`, blob)
      setMessage('Mood summary card downloaded.')
    }, 'image/png')
  }

  if (loading) return <LoadingSkeleton lines={6} />

  return (
    <main className="space-y-4">
      <h2 className="serif-reading text-3xl text-[#302a4c]">Settings</h2>
      {error && <ErrorState message={error} onAction={() => void load()} actionLabel="Try again" />}
      {message && <div className="app-card p-3 text-sm text-[#636b7e]">{message}</div>}

      <section className="app-card space-y-4 p-5">
        <h3 className="text-lg font-semibold">Profile & plan</h3>
        <p className="text-sm text-[#687084]">Current plan: <span className="uppercase text-[#483f89]">{plan}</span></p>
      </section>

      <section className="app-card space-y-4 p-5">
        <h3 className="text-lg font-semibold">Preferences</h3>
        <label className="flex items-center justify-between rounded-2xl bg-[#f8f2ec] p-3"><span>Weekly summary email</span><input id="weekly-email" name="weekly-email" type="checkbox" checked={weeklyEmail} onChange={(event) => setWeeklyEmail(event.target.checked)} /></label>
        <label className="flex items-center justify-between rounded-2xl bg-[#f8f2ec] p-3"><span>Insight nudges</span><input id="insight-nudges" name="insight-nudges" type="checkbox" checked={insightNudges} onChange={(event) => setInsightNudges(event.target.checked)} /></label>
      </section>

      <section className="app-card space-y-3 p-5">
        <h3 className="text-lg font-semibold">Data & sharing</h3>
        <button onClick={() => void exportJson()} disabled={busy} className="premium-button">{busy ? 'Preparing export…' : 'Export my data'}</button>
        <button onClick={downloadMoodCard} className="soft-pill">Download mood card</button>
      </section>

      <section className="rounded-3xl bg-[#f6dfe1]/80 p-5 shadow-[0_10px_30px_rgba(142,67,78,0.15)]">
        <h3 className="text-lg font-semibold text-[#7c3141]">Danger zone</h3>
        <p className="mt-2 text-sm text-[#8a4c58]">Delete account and all journal data permanently.</p>
        <button className="mt-3 rounded-2xl bg-[#b86270] px-4 py-2 text-sm font-semibold text-white">Delete account</button>
      </section>
    </main>
  )
}
