import html2canvas from 'html2canvas'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'
import { MoodScoreRing } from '../components/MoodScoreRing'
import { useEntriesQuery } from '../services/api'

export function ResultPage() {
  const { id } = useParams(); const { data } = useEntriesQuery(); const entry = data?.find((e)=>e.id===id) ?? data?.[0]
  const [note, setNote] = useState(''); const cardRef = useRef<HTMLDivElement>(null)
  if (!entry) return null
  const share = async () => { if (!cardRef.current) return; const canvas = await html2canvas(cardRef.current); const a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download='echo-card.png'; a.click(); toast.success('Card generated') }
  return <div className="space-y-4" ref={cardRef}><div className="inline-block rounded-full bg-primary px-4 py-1">{entry.primary_mood_tag}</div><div className="inline-block rounded-full bg-surface px-3 py-1">{entry.secondary_mood_tag}</div><div className="grid place-items-center"><MoodScoreRing score={entry.mood_score}/></div><div className="rounded bg-surface p-3">Energy <div className="h-2 rounded bg-black/30"><div className="h-2 rounded bg-secondary" style={{width:`${entry.energy_score}%`}}/></div></div><div className="rounded bg-surface p-3">Stress <div className="h-2 rounded bg-black/30"><div className="h-2 rounded bg-red-400" style={{width:`${entry.stress_score}%`}}/></div></div><h2 className="text-xl font-semibold">{entry.mood_summary}</h2><div className="rounded bg-surface p-3">{entry.emotional_insight}</div><div className="rounded bg-surface p-3 italic">{entry.reflection_paragraph}</div><div className="flex gap-3"><button className="rounded bg-surface px-4 py-2">👍</button><button className="rounded bg-surface px-4 py-2">👎</button></div><textarea maxLength={280} value={note} onChange={(e)=>setNote(e.target.value)} className="w-full rounded bg-surface p-3" placeholder="Add a note"/><div className="text-right text-sm text-textSecondary">{note.length}/280</div><button onClick={share} className="w-full rounded bg-primary p-3">Share</button><Link to="/" className="text-primary underline">View Dashboard</Link></div>
}
