import { useMemo, useState } from 'react'

export function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Array<{ label: string; action: () => void }> }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())), [commands, query])
  if (!open) return null

  return (
    <div className="absolute inset-0 z-40 bg-black/40" onClick={onClose}>
      <div className="mx-auto mt-20 w-[min(560px,90vw)] rounded-xl border border-white/10 bg-[#111525] p-3" onClick={(e) => e.stopPropagation()}>
        <input autoFocus className="mb-2 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100" placeholder="Type a command…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="max-h-64 space-y-1 overflow-auto">
          {filtered.map((command) => (
            <button key={command.label} className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-300 hover:bg-white/10" onClick={() => { command.action(); onClose() }}>
              {command.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
