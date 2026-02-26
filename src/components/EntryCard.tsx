import { useRef, useState } from 'react'
import type { JournalEntry } from '../types'

const moodColor: Record<string, string> = {
  happy: '#7aa17a',
  excited: '#84b78c',
  grateful: '#85a77a',
  calm: '#7b93b3',
  reflective: '#8f8abf',
  neutral: '#a79f95',
  anxious: '#b68770',
  stressed: '#bf7b6e',
  frustrated: '#b36f6f',
  sad: '#8f7fa0',
}

interface EntryCardProps {
  entry: JournalEntry
  onTitleSave?: (id: string, title: string) => void
  onDelete?: (id: string) => void
}

export function EntryCard({ entry, onTitleSave, onDelete }: EntryCardProps) {
  const accent = moodColor[entry.mood_primary] ?? '#8f8abf'
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(entry.entry_title)
  const [showMenu, setShowMenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function commitTitle() {
    const newTitle = title.trim() || 'Untitled Entry'
    setTitle(newTitle)
    setEditing(false)
    if (newTitle !== entry.entry_title && onTitleSave) {
      onTitleSave(entry.id, newTitle)
    }
  }

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (onDelete && window.confirm('Are you sure you want to delete this entry?')) {
      onDelete(entry.id)
    }
    setShowMenu(false)
  }

  return (
    <article className="app-card overflow-hidden">
      <div className="flex">
        <div className="w-1.5" style={{ backgroundColor: accent }} />
        <div className="flex-1 p-5">
          <div className="flex items-start justify-between gap-2">
            {editing ? (
              <input
                ref={inputRef}
                className="flex-1 bg-transparent text-base font-semibold text-[#1f2433] outline-none border-b-2 border-[#7f78d4] dark:text-gray-100 dark:border-[#958cff]"
                value={title}
                placeholder="Untitled Entry"
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitTitle() } if (e.key === 'Escape') { setTitle(entry.entry_title); setEditing(false) } }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                autoFocus
              />
            ) : (
              <h3
                className="flex-1 text-base font-semibold text-[#1f2433] cursor-pointer dark:text-gray-100 hover:border-b hover:border-dashed hover:border-[#7f78d4]/40"
                onClick={(e) => {
                  if (onTitleSave) {
                    e.preventDefault()
                    e.stopPropagation()
                    setEditing(true)
                    setTimeout(() => inputRef.current?.focus(), 0)
                  }
                }}
                title={onTitleSave ? 'Click to edit title' : undefined}
              >
                {title}
              </h3>
            )}
            {onDelete && (
              <div className="relative">
                <button
                  className="rounded-full p-1 text-[#9a9aaa] transition hover:bg-[#f1ece6] hover:text-[#5f2f3b] dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-rose-300"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu((v) => !v) }}
                  title="Entry options"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg>
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(false) }} />
                    <div className="absolute right-0 top-7 z-20 min-w-[140px] rounded-xl border border-[#e7e1da] bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-slate-800">
                      <button
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#5f2f3b] transition hover:bg-[#fdf0f0] dark:text-rose-300 dark:hover:bg-rose-950/30"
                        onClick={handleDelete}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-[#5f6678] dark:text-slate-300">{entry.cleaned_entry}</p>
          <div className="mt-4 flex items-center justify-between text-xs text-[#6b7182] dark:text-slate-400">
            <span className="soft-pill capitalize">{entry.mood_primary}</span>
            <span>{new Date(entry.recorded_at).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </article>
  )
}
