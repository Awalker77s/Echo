import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EntryCard } from '../components/EntryCard'
import { supabase } from '../lib/supabase'
import type { JournalEntry } from '../types'

export function TimelinePage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [search, setSearch] = useState('')
  const [touchStartX, setTouchStartX] = useState<Record<string, number>>({})
  const [offsets, setOffsets] = useState<Record<string, number>>({})

  async function load() {
    if (!supabase) return
    const { data: profile } = await supabase.from('users').select('plan').single()
    let query = supabase.from('journal_entries').select('*').order('recorded_at', { ascending: false }).limit(200)

    if ((profile?.plan ?? 'free') === 'free') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('recorded_at', sevenDaysAgo)
    }

    if (search.trim()) query = query.ilike('cleaned_entry', `%${search.trim()}%`)
    const { data } = await query
    if (data) setEntries(data as JournalEntry[])
  }

  useEffect(() => { void load() }, [search])

  const grouped = useMemo(() => entries.reduce<Record<string, JournalEntry[]>>((acc, entry) => {
    const key = new Date(entry.recorded_at).toDateString()
    if (!acc[key]) acc[key] = []
    acc[key].push(entry)
    return acc
  }, {}), [entries])

  async function deleteEntry(id: string) {
    if (!supabase) return
    await supabase.from('journal_entries').delete().eq('id', id)
    setEntries((current) => current.filter((entry) => entry.id !== id))
  }

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="serif-reading text-3xl text-[#312c4f]">Timeline</h2>
        <button className="soft-pill" onClick={() => void load()}>Refresh</button>
      </div>
      <input
        className="app-card w-full px-4 py-3 text-sm outline-none"
        placeholder="Search entries"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="space-y-7">
        {Object.entries(grouped).map(([date, dayEntries]) => (
          <section key={date} className="space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-xs uppercase tracking-[0.16em] text-[#8a8398]">{date}</h3>
              <div className="h-px flex-1 bg-[#dfd7d0]" />
            </div>
            {dayEntries.map((entry) => {
              const offset = offsets[entry.id] ?? 0
              return (
                <div key={entry.id} className="relative overflow-hidden rounded-3xl">
                  <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-3">
                    <button className="soft-pill" onClick={() => setOffsets((old) => ({ ...old, [entry.id]: 0 }))}>Reset</button>
                    <button className="rounded-full bg-[#e4b6bc] px-3 py-1 text-xs text-[#5f2f3b]" onClick={() => void deleteEntry(entry.id)}>Delete</button>
                  </div>
                  <div
                    style={{ transform: `translateX(${offset}px)`, transition: 'transform 180ms ease' }}
                    onTouchStart={(event) => setTouchStartX((old) => ({ ...old, [entry.id]: event.touches[0].clientX }))}
                    onTouchMove={(event) => {
                      const start = touchStartX[entry.id] ?? event.touches[0].clientX
                      const delta = event.touches[0].clientX - start
                      setOffsets((old) => ({ ...old, [entry.id]: Math.min(0, Math.max(-120, delta)) }))
                    }}
                    onTouchEnd={() => setOffsets((old) => ({ ...old, [entry.id]: (old[entry.id] ?? 0) < -60 ? -92 : 0 }))}
                  >
                    <Link to={`/entries/${entry.id}`}><EntryCard entry={entry} /></Link>
                  </div>
                </div>
              )
            })}
          </section>
        ))}
      </div>
    </main>
  )
}
