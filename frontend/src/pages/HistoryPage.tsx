import { useMemo, useState } from 'react'
import { MoodScoreRing } from '../components/MoodScoreRing'
import { useEntriesQuery } from '../services/api'
import { useAppStore } from '../store/useAppStore'

export function HistoryPage() {
  const { data } = useEntriesQuery(); const [open, setOpen] = useState<string | null>(null); const [unblur, setUnblur] = useState<Record<string,boolean>>({}); const tier = useAppStore((s)=>s.tier)
  const now = Date.now()
  const entries = useMemo(()=>data?.map(e=>({...e,isOld: now - new Date(e.created_at).getTime() > 7*24*3600*1000})) ?? [],[data,now])
  return <div className="space-y-3"><h1 className="text-2xl font-bold">History</h1><div className="flex gap-2 overflow-auto"><button className="rounded bg-surface px-3 py-1">All Tags</button><input type="date" className="rounded bg-surface px-3 py-1"/><input type="date" className="rounded bg-surface px-3 py-1"/></div>{entries.map(e=><div key={e.id} className="rounded-xl bg-surface p-3"><div className="flex items-center justify-between"><div><div className="text-sm text-textSecondary">{new Date(e.created_at).toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'})}</div><span className="rounded bg-primary/20 px-2 py-1 text-xs">{e.primary_mood_tag}</span></div><MoodScoreRing score={e.mood_score} size={40}/></div><p className="mt-2">{e.mood_summary}</p><img src={e.thumbnail} className={`mt-2 h-20 w-full rounded object-cover ${(e.isOld && tier==='free' && !unblur[e.id])?'blur-sm':''}`} /><button className="mt-2 text-sm text-primary" onClick={()=>setUnblur(s=>({...s,[e.id]:!s[e.id]}))}>Toggle thumbnail blur</button>{e.isOld && tier==='free' && <div className="mt-2 rounded bg-black/30 p-2 text-sm">Older entries are premium. <a href="/upgrade" className="underline">Upgrade</a></div>}<button className="mt-2 text-sm underline" onClick={()=>setOpen(open===e.id?null:e.id)}>Expand</button>{open===e.id && <div className="mt-2 space-y-2 text-sm"><p>{e.emotional_insight}</p><p className="italic">{e.reflection_paragraph}</p></div>}</div>)}</div>
}
