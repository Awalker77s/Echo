import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EntryCard } from '../components/EntryCard'
import { ErrorState } from '../components/ErrorState'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { supabase } from '../lib/supabase'
import type { JournalEntry } from '../types'

export function TimelinePage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!supabase) {
      setError('Supabase is not configured.')
      setLoading(false)
      return
    }
    setLoading(true)
    const { data: profile, error: profileError } = await supabase.from('users').select('plan').single()
    if (profileError) {
      setError('Unable to load your plan details.')
      setLoading(false)
      return
    }
    let query = supabase.from('journal_entries').select('*').order('recorded_at', { ascending: false }).limit(200)

    if ((profile?.plan ?? 'free') === 'free') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('recorded_at', sevenDaysAgo)
    }

    if (search.trim()) query = query.ilike('cleaned_entry', `%${search.trim()}%`)
    const { data, error: queryError } = await query
    if (queryError) {
      console.error('[TimelinePage] Failed to load entries:', queryError.message, queryError.code)
      setError('Unable to load your timeline right now.')
    } else {
      setEntries((data as JournalEntry[]) ?? [])
      setError(null)
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [search])

  const grouped = useMemo(() => entries.reduce<Record<string, JournalEntry[]>>((acc, entry) => {
    const key = new Date(entry.recorded_at).toDateString()
    if (!acc[key]) acc[key] = []
    acc[key].push(entry)
    return acc
  }, {}), [entries])

  async function deleteEntry(id: string) {
    if (!supabase) {
      setError('Supabase is not configured.')
      setLoading(false)
      return
    }
    const { error: deleteError } = await supabase.from('journal_entries').delete().eq('id', id)
    if (deleteError) {
      setError('Unable to delete this entry. Please try again.')
      return
    }
    setEntries((current) => current.filter((entry) => entry.id !== id))
  }

  async function updateTitle(id: string, newTitle: string) {
    if (!supabase) return
    const { error: updateError } = await supabase.from('journal_entries').update({ entry_title: newTitle }).eq('id', id)
    if (updateError) {
      setError('Unable to update the title. Please try again.')
      return
    }
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, entry_title: newTitle } : entry))
  }



  if (loading) return <LoadingSkeleton lines={6} />

  return (
    <main className="space-y-4 dark:text-gray-100">
      <div className="flex items-center justify-between">
        <h2 className="serif-reading text-3xl text-[#312c4f] dark:text-gray-100">Timeline</h2>
        <button className="soft-pill" onClick={() => void load()}>Refresh</button>
      </div>
      {error && <ErrorState message={error} onAction={() => void load()} actionLabel="Try again" />}
      <input
        className="app-card w-full px-4 py-3 text-sm outline-none dark:bg-slate-800 dark:text-gray-100"
        placeholder="Search entries"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {!entries.length && !error && <div className="app-card p-4 text-[#6b7386] dark:text-slate-300">No entries found for this timeframe.</div>}

      <div className="space-y-7">
        {Object.entries(grouped).map(([date, dayEntries]) => (
          <section key={date} className="space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-xs uppercase tracking-[0.16em] text-[#8a8398] dark:text-slate-400">{date}</h3>
              <div className="h-px flex-1 bg-[#dfd7d0] dark:bg-slate-700" />
            </div>
            {dayEntries.map((entry) => (
              <div key={entry.id}>
                <Link to={`/entries/${entry.id}`}>
                  <EntryCard
                    entry={entry}
                    onTitleSave={(id, title) => void updateTitle(id, title)}
                    onDelete={(id) => void deleteEntry(id)}
                  />
                </Link>
              </div>
            ))}
          </section>
        ))}
      </div>
    </main>
  )
}
