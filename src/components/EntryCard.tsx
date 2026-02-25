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

export function EntryCard({ entry }: { entry: JournalEntry }) {
  const accent = moodColor[entry.mood_primary] ?? '#8f8abf'

  return (
    <article className="app-card overflow-hidden">
      <div className="flex">
        <div className="w-1.5" style={{ backgroundColor: accent }} />
        <div className="flex-1 p-5">
          <h3 className="text-base font-semibold text-[#1f2433]">{entry.entry_title}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-[#5f6678]">{entry.cleaned_entry}</p>
          <div className="mt-4 flex items-center justify-between text-xs text-[#6b7182]">
            <span className="soft-pill capitalize">{entry.mood_primary}</span>
            <span>{new Date(entry.recorded_at).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </article>
  )
}
