import { useMemo, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { JournalEntry } from '../types'

interface TimelinePanelProps {
  entries: JournalEntry[]
  loading: boolean
}

function DraggableEntryCard({ entry }: { entry: JournalEntry }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
    data: entry,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  }

  const dateStr = new Date(entry.recorded_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="group cursor-grab rounded-xl border border-white/[0.06] bg-white/[0.04] p-3 transition-colors hover:border-[#8b82ff]/30 hover:bg-white/[0.07] active:cursor-grabbing"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {dateStr}
        </span>
        <div className="flex items-center gap-1 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          <span className="text-[9px]">drag</span>
        </div>
      </div>
      <h4 className="text-sm font-semibold leading-snug text-gray-200">
        {entry.entry_title}
      </h4>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
        {entry.cleaned_entry}
      </p>
      {entry.mood_primary && (
        <span className="mt-2 inline-block rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] capitalize text-slate-400">
          {entry.mood_primary}
        </span>
      )}
    </div>
  )
}

export function TimelinePanel({ entries, loading }: TimelinePanelProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return entries
    const q = search.toLowerCase()
    return entries.filter(
      (e) =>
        e.entry_title.toLowerCase().includes(q) ||
        e.cleaned_entry.toLowerCase().includes(q),
    )
  }, [entries, search])

  return (
    <aside className="flex h-full flex-col border-r border-white/[0.06] bg-[#0c0f1a]">
      <div className="border-b border-white/[0.06] p-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">
          Journal Entries
        </h3>
        <p className="mt-1 text-[11px] text-slate-500">
          Drag an entry to the canvas
        </p>
        <input
          className="mt-3 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-gray-200 placeholder:text-slate-600 outline-none focus:border-[#8b82ff]/40"
          placeholder="Search entries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3 scrollbar-thin">
        {loading && (
          <div className="space-y-3 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="p-4 text-center text-xs text-slate-500">
            {search ? 'No matching entries.' : 'No journal entries yet.'}
          </p>
        )}

        {!loading &&
          filtered.map((entry) => (
            <DraggableEntryCard key={entry.id} entry={entry} />
          ))}
      </div>
    </aside>
  )
}
