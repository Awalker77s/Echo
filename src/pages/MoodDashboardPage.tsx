import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ErrorState } from '../components/ErrorState'
import { FeatureGate } from '../components/FeatureGate'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { useUserPlan } from '../hooks/useUserPlan'
import { supabase } from '../lib/supabase'
import type { MoodLevel, MoodPoint } from '../types'

const ranges = [
  { key: '30', label: '30D', days: 30 },
  { key: '90', label: '90D', days: 90 },
  { key: '180', label: '180D', days: 180 },
]

const moodLevels: { level: MoodLevel; color: string; bg: string; border: string; darkColor: string; darkBg: string; darkBorder: string }[] = [
  { level: 'Extremely Positive', color: '#2d8a4e', bg: '#d1f5de', border: '#a3e4b8', darkColor: '#6ee7b7', darkBg: '#064e3b', darkBorder: '#065f46' },
  { level: 'Positive', color: '#5a9e6f', bg: '#e4f5ea', border: '#c2e0cc', darkColor: '#86efac', darkBg: '#14532d', darkBorder: '#166534' },
  { level: 'Neutral', color: '#8a7e3d', bg: '#f5f0d1', border: '#e0d9a3', darkColor: '#fcd34d', darkBg: '#451a03', darkBorder: '#78350f' },
  { level: 'Negative', color: '#9e6a5a', bg: '#f5e0d8', border: '#e0bfb3', darkColor: '#fca5a5', darkBg: '#450a0a', darkBorder: '#7f1d1d' },
  { level: 'Extremely Negative', color: '#8a3d3d', bg: '#f5d1d1', border: '#e0a3a3', darkColor: '#f87171', darkBg: '#3b0000', darkBorder: '#991b1b' },
]

function scoreMoodLevel(score: number): MoodLevel {
  if (score >= 0.7) return 'Extremely Positive'
  if (score >= 0.1) return 'Positive'
  if (score >= -0.1) return 'Neutral'
  if (score >= -0.7) return 'Negative'
  return 'Extremely Negative'
}

function getMoodConfig(level: MoodLevel) {
  return moodLevels.find((m) => m.level === level) ?? moodLevels[2]
}

export function MoodDashboardPage() {
  const [points, setPoints] = useState<MoodPoint[]>([])
  const [range, setRange] = useState(ranges[0])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const { plan, loading: planLoading, error: planError } = useUserPlan()

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    async function load() {
      if (!supabase) {
        setError('Supabase is not configured.')
        setLoading(false)
        return
      }
      setLoading(true)
      const since = new Date(Date.now() - range.days * 24 * 60 * 60 * 1000).toISOString()
      const { data, error: queryError } = await supabase
        .from('mood_history')
        .select('id,recorded_at,mood_score,mood_primary,mood_level')
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true })
      if (queryError) {
        console.error('[MoodDashboardPage] Failed to load mood history:', queryError.message, queryError.code)
        setError('Unable to load mood history right now.')
      } else {
        setPoints((data as MoodPoint[]) ?? [])
        setError(null)
      }
      setLoading(false)
    }

    void load()
  }, [range])

  const chartData = useMemo(
    () => points.map((point) => ({ day: new Date(point.recorded_at).toLocaleDateString(), score: Number(point.mood_score ?? 0), mood: point.mood_primary })),
    [points],
  )

  const dayGroups = useMemo(() => {
    const groups: Record<string, { date: string; level: MoodLevel; score: number; primary: string; count: number }> = {}
    for (const point of points) {
      const dayKey = new Date(point.recorded_at).toLocaleDateString('en-CA')
      const level = (point.mood_level as MoodLevel) ?? scoreMoodLevel(Number(point.mood_score ?? 0))
      if (!groups[dayKey]) {
        groups[dayKey] = { date: dayKey, level, score: Number(point.mood_score ?? 0), primary: point.mood_primary, count: 1 }
      } else {
        groups[dayKey].count += 1
        // Use the most negative score for the day so a single negative entry
        // is never averaged away into neutral by a positive entry on the same day.
        groups[dayKey].score = Math.min(groups[dayKey].score, Number(point.mood_score ?? 0))
        groups[dayKey].level = scoreMoodLevel(groups[dayKey].score)
        groups[dayKey].primary = point.mood_primary
      }
    }
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date))
  }, [points])

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const level of moodLevels) counts[level.level] = 0
    for (const day of dayGroups) counts[day.level] = (counts[day.level] ?? 0) + 1
    return counts
  }, [dayGroups])

  if (planLoading || loading) return <LoadingSkeleton lines={6} />
  if (planError) return <ErrorState message={planError} />

  return (
    <FeatureGate userPlan={plan} requiredPlan="core" featureName="Mood Dashboard">
      <main className="space-y-5 dark:text-gray-100">
        <h2 className="serif-reading text-3xl text-[#302b4d] dark:text-gray-100">Mood Dashboard</h2>
        <div className="flex gap-2">
          {ranges.map((r) => (
            <button key={r.key} onClick={() => setRange(r)} className={`soft-pill ${range.key === r.key ? 'bg-[#e5e0fd] text-[#4e478f] dark:bg-[#37306f] dark:text-[#c4bdff]' : ''}`}>
              {r.label}
            </button>
          ))}
        </div>
        {error ? (
          <ErrorState message={error} />
        ) : (
          <>
            {/* Mood Level Summary */}
            <div className="grid grid-cols-5 gap-2">
              {moodLevels.map((m) => (
                <div
                  key={m.level}
                  className="rounded-2xl p-3 text-center"
                  style={{
                    backgroundColor: isDark ? m.darkBg : m.bg,
                    borderColor: isDark ? m.darkBorder : m.border,
                    borderWidth: 1,
                    borderStyle: 'solid',
                  }}
                >
                  <p className="text-2xl font-semibold" style={{ color: isDark ? m.darkColor : m.color }}>{levelCounts[m.level] ?? 0}</p>
                  <p className="mt-1 text-[10px] leading-tight sm:text-xs" style={{ color: isDark ? m.darkColor : m.color }}>{m.level}</p>
                </div>
              ))}
            </div>

            {/* Mood Trend Chart */}
            <div className="app-card h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 14, right: 12, bottom: 10, left: -12 }}>
                  <defs>
                    <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7f78d4" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#7f78d4" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <ReferenceArea y1={0.7} y2={1} fill={isDark ? '#064e3b' : '#d1f5de'} fillOpacity={0.5} />
                  <ReferenceArea y1={0.1} y2={0.7} fill={isDark ? '#14532d' : '#e4f5ea'} fillOpacity={0.5} />
                  <ReferenceArea y1={-0.1} y2={0.1} fill={isDark ? '#451a03' : '#f5f0d1'} fillOpacity={0.5} />
                  <ReferenceArea y1={-0.7} y2={-0.1} fill={isDark ? '#450a0a' : '#f5e0d8'} fillOpacity={0.5} />
                  <ReferenceArea y1={-1} y2={-0.7} fill={isDark ? '#3b0000' : '#f5d1d1'} fillOpacity={0.5} />
                  <CartesianGrid stroke={isDark ? '#334155' : '#e5ddd4'} strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fill: isDark ? '#94a3b8' : '#7a7188', fontSize: 11 }} minTickGap={24} />
                  <YAxis domain={[-1, 1]} tick={{ fill: isDark ? '#94a3b8' : '#7a7188', fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 14, border: 'none', background: isDark ? '#1e293b' : '#fff8f2', color: isDark ? '#f3f4f6' : '#2f2a3e' }} />
                  <Area type="monotone" dataKey="score" stroke="#6f6ac8" fillOpacity={1} fill="url(#moodGradient)" strokeWidth={3} isAnimationActive animationDuration={900} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Mood Board - Day-by-day grid */}
            <div>
              <h3 className="mb-3 text-lg font-semibold text-[#3d3660] dark:text-slate-100">Mood Board</h3>
              {dayGroups.length === 0 ? (
                <div className="app-card p-4 text-[#6b7386] dark:text-slate-300">No mood entries yet. Record a journal entry to start tracking your mood.</div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {dayGroups.map((day) => {
                    const config = getMoodConfig(day.level)
                    return (
                      <div
                        key={day.date}
                        className="rounded-2xl p-4 transition-transform hover:scale-[1.02]"
                        style={{
                          backgroundColor: isDark ? config.darkBg : config.bg,
                          borderColor: isDark ? config.darkBorder : config.border,
                          borderWidth: 1,
                          borderStyle: 'solid',
                        }}
                      >
                        <p className="text-xs font-medium" style={{ color: isDark ? config.darkColor : '#7a7188' }}>
                          {new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                        <p className="mt-1 text-sm font-semibold capitalize" style={{ color: isDark ? config.darkColor : config.color }}>{day.primary}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)' }}>
                            <div className="h-full rounded-full" style={{ backgroundColor: isDark ? config.darkColor : config.color, width: `${Math.round(((Number(day.score) + 1) / 2) * 100)}%` }} />
                          </div>
                        </div>
                        <p className="mt-1 text-xs" style={{ color: isDark ? config.darkColor : config.color }}>{day.level}</p>
                        {day.count > 1 && <p className="mt-1 text-xs" style={{ color: isDark ? '#94a3b8' : '#8a8a9a' }}>{day.count} entries</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </FeatureGate>
  )
}
