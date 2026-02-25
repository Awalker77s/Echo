import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import type { MoodPoint } from '../types'

const ranges = [
  { key: '30', label: '30D', days: 30 },
  { key: '90', label: '90D', days: 90 },
  { key: '180', label: '180D', days: 180 },
]

export function MoodDashboardPage() {
  const [points, setPoints] = useState<MoodPoint[]>([])
  const [range, setRange] = useState(ranges[0])

  useEffect(() => {
    async function load() {
      if (!supabase) return
      const since = new Date(Date.now() - range.days * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('mood_history')
        .select('id,recorded_at,mood_score,mood_primary')
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true })
      if (data) setPoints(data as MoodPoint[])
    }

    void load()
  }, [range])

  const chartData = useMemo(
    () => points.map((point) => ({ day: new Date(point.recorded_at).toLocaleDateString(), score: Number(point.mood_score ?? 0), mood: point.mood_primary })),
    [points],
  )

  return (
    <main className="space-y-5">
      <h2 className="serif-reading text-3xl text-[#302b4d]">Mood Dashboard</h2>
      <div className="flex gap-2">
        {ranges.map((r) => (
          <button key={r.key} onClick={() => setRange(r)} className={`soft-pill ${range.key === r.key ? 'bg-[#e5e0fd] text-[#4e478f]' : ''}`}>
            {r.label}
          </button>
        ))}
      </div>
      <div className="app-card h-96 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 14, right: 12, bottom: 10, left: -12 }}>
            <defs>
              <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7f78d4" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#7f78d4" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <ReferenceArea y1={0.3} y2={1} fill="#d6ebd6" fillOpacity={0.45} />
            <ReferenceArea y1={-0.2} y2={0.3} fill="#f4e4c8" fillOpacity={0.45} />
            <ReferenceArea y1={-1} y2={-0.2} fill="#efd3d7" fillOpacity={0.45} />
            <CartesianGrid stroke="#e5ddd4" strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fill: '#7a7188', fontSize: 11 }} minTickGap={24} />
            <YAxis domain={[-1, 1]} tick={{ fill: '#7a7188', fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 14, border: 'none', background: '#fff8f2' }} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#6f6ac8"
              fillOpacity={1}
              fill="url(#moodGradient)"
              strokeWidth={3}
              isAnimationActive
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </main>
  )
}
