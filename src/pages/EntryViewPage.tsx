import { type FormEvent, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { ErrorState } from '../components/ErrorState'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { supabase } from '../lib/supabase'
import type { Idea, JournalEntry } from '../types'

export function EntryViewPage() {
  const { id } = useParams()
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [showIdeas, setShowIdeas] = useState(true)
  const [draft, setDraft] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<string>('')
  const [titleDraft, setTitleDraft] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      if (!supabase || !id) {
        setError('Missing entry identifier.')
        setLoading(false)
        return
      }
      setLoading(true)
      const [{ data: entryData, error: entryError }, { data: ideasData, error: ideasError }] = await Promise.all([
        supabase.from('journal_entries').select('*').eq('id', id).single(),
        supabase.from('ideas').select('*').eq('entry_id', id),
      ])

      if (entryError || !entryData) {
        setError('Unable to load this entry right now.')
        setLoading(false)
        return
      }

      const row = entryData as JournalEntry
      setEntry(row)
      setDraft(row.cleaned_entry)
      setTitleDraft(row.entry_title)

      if (row.audio_url) {
        const { data: signed, error: signedUrlError } = await supabase.storage.from('journal-audio').createSignedUrl(row.audio_url, 600)
        if (!signedUrlError) setAudioUrl(signed?.signedUrl ?? null)
      }

      if (!ideasError) setIdeas((ideasData as Idea[]) ?? [])
      setError(null)
      setLoading(false)
    }

    void load()
  }, [id])

  async function saveTitle() {
    if (!supabase || !entry) return
    const newTitle = titleDraft.trim() || 'Untitled Entry'
    setTitleDraft(newTitle)
    setEditingTitle(false)
    if (newTitle === entry.entry_title) return
    const { data, error: saveError } = await supabase.from('journal_entries').update({ entry_title: newTitle }).eq('id', entry.id).select('*').single()
    if (saveError || !data) return
    setEntry(data as JournalEntry)
  }

  async function saveEdits(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !entry) return
    setSaveState('Saving...')
    const { data, error: saveError } = await supabase.from('journal_entries').update({ cleaned_entry: draft, entry_title: titleDraft.trim() || 'Untitled Entry' }).eq('id', entry.id).select('*').single()
    if (saveError || !data) {
      setSaveState('Could not save changes. Please try again.')
      return
    }
    setEntry(data as JournalEntry)
    setTitleDraft(data.entry_title)
    setSaveState('Changes saved.')
  }

  if (loading) return <LoadingSkeleton lines={6} />
  if (error || !entry) return <ErrorState message={error ?? 'Entry not found.'} />

  return (
    <motion.main initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 dark:text-gray-100">
      <section className="app-card p-6 md:p-8">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            id="entry-title"
            name="entry-title"
            className="serif-reading w-full bg-transparent text-4xl text-[#2d2948] outline-none border-b-2 border-[#7f78d4] dark:text-gray-100"
            value={titleDraft}
            placeholder="Untitled Entry"
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => void saveTitle()}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void saveTitle() } }}
            autoFocus
          />
        ) : (
          <h2
            className="serif-reading text-4xl text-[#2d2948] cursor-pointer hover:border-b-2 hover:border-dashed hover:border-[#7f78d4]/40 dark:text-gray-100"
            onClick={() => { setEditingTitle(true); setTimeout(() => titleInputRef.current?.focus(), 0) }}
            title="Click to edit title"
          >
            {entry.entry_title}
          </h2>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="soft-pill capitalize">{entry.mood_primary}</span>
          {entry.themes?.map((theme) => <span key={theme} className="soft-pill">#{theme}</span>)}
        </div>
      </section>

      {audioUrl && (
        <section className="app-card p-5">
          <h3 className="text-sm font-semibold text-[#636b7e] dark:text-slate-400">Original voice</h3>
          <div className="mt-3 rounded-2xl bg-[#f7f2ed] p-3 dark:bg-slate-700">
            <div className="mb-2 h-8 rounded-xl bg-gradient-to-r from-[#d9d4ff] via-[#ece8ff] to-[#d8d3ff] dark:from-[#37306f] dark:via-[#4a428a] dark:to-[#37306f]" />
            <audio controls className="w-full" src={audioUrl} />
          </div>
        </section>
      )}

      <section className="app-card p-5">
        <h3 className="mb-2 text-sm font-semibold text-[#636b7e] dark:text-slate-400">Edit entry</h3>
        <form onSubmit={(event) => void saveEdits(event)} className="space-y-3">
          <textarea id="entry-body" name="entry-body" className="min-h-56 w-full rounded-2xl bg-[#f8f3ed] p-4 text-[#3d4254] outline-none dark:bg-slate-700 dark:text-gray-100" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <button className="premium-button">Save changes</button>
          {saveState && <p className="text-sm text-[#636b7e] dark:text-slate-400">{saveState}</p>}
        </form>
      </section>

      <section className="app-card p-5">
        <button className="flex w-full items-center justify-between" onClick={() => setShowIdeas((value) => !value)}>
          <h3 className="text-lg font-semibold text-[#2f3551] dark:text-gray-100">Extracted ideas</h3>
          <span className="soft-pill">{showIdeas ? 'Hide' : 'Show'}</span>
        </button>
        {showIdeas && (
          <ul className="mt-3 space-y-2">
            {ideas.map((idea) => (
              <li key={idea.id} className="rounded-2xl bg-[#f8f3ee] p-3 dark:bg-slate-700">
                <p className="dark:text-gray-200">{idea.content}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-[#83889b] dark:text-slate-400">{idea.category}</p>
              </li>
            ))}
            {!ideas.length && <li className="text-sm text-[#6b7386] dark:text-slate-400">No ideas were extracted for this entry.</li>}
          </ul>
        )}
      </section>
    </motion.main>
  )
}
