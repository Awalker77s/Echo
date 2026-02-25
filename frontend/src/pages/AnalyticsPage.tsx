import { useMemo, useState } from 'react'
import { Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useEntriesQuery, useTrendQuery } from '../services/api'
import { useAppStore } from '../store/useAppStore'

export function AnalyticsPage() {
  const [tab,setTab]=useState<'Week'|'Month'|'Year'>('Month'); const { data:trend=[] } = useTrendQuery(); const { data:entries=[] } = useEntriesQuery(); const tier = useAppStore((s)=>s.tier)
  const distribution = useMemo(()=>Object.values(entries.reduce((a,e)=>{a[e.primary_mood_tag]=(a[e.primary_mood_tag]??0)+1;return a},{} as Record<string,number>)).map((v,i)=>({name:Object.keys(entries.reduce((a,e)=>{a[e.primary_mood_tag]=1;return a},{} as Record<string,number>))[i], value:v})),[entries])
  const top = [...distribution].sort((a,b)=>b.value-a.value).slice(0,3)
  const blur = tier==='free'
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Analytics</h1><div className="flex gap-2">{(['Week','Month','Year'] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={`rounded px-3 py-1 ${tab===t?'bg-primary':'bg-surface'}`}>{t}</button>)}</div><div className="relative rounded bg-surface p-3"><h3>Mood Trend</h3><div className={blur?'blur-sm':''}><ResponsiveContainer width="100%" height={180}><LineChart data={trend}><XAxis dataKey="day"/><YAxis/><Tooltip/><Line dataKey="mood_score" stroke="#7B61FF"/></LineChart></ResponsiveContainer></div>{blur&&<div className="absolute inset-0 grid place-items-center"><a href="/upgrade" className="rounded bg-primary px-4 py-2">Unlock Analytics</a></div>}</div><div className="rounded bg-surface p-3"><h3>Energy Heatmap</h3><div className={`grid grid-cols-7 gap-1 ${blur?'blur-sm':''}`}>{trend.slice(0,28).map((d,i)=><div key={i} className="h-6 rounded" style={{background:`rgba(0,212,170,${(d.energy_score ?? 50)/100})`}}/>)}</div></div><div className="rounded bg-surface p-3"><h3>Mood Donut</h3><div className={blur?'blur-sm':''}><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={distribution} dataKey="value" nameKey="name" outerRadius={80} fill="#7B61FF" /></PieChart></ResponsiveContainer></div></div><div className="rounded bg-surface p-3"><h3>Top Moods</h3>{top.map(t=><div key={t.name}>{t.name}: {Math.round((t.value/entries.length)*100)||0}%</div>)}</div></div>
}
