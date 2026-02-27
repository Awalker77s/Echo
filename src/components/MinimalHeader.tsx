import { useEffect, useRef, useState } from 'react'
import type { IdeaEngineSettings } from '../types'

interface MinimalHeaderProps {
  generating: boolean
  mode: IdeaEngineSettings['mode']
  onModeChange: (mode: IdeaEngineSettings['mode']) => void
  onGenerate: () => void
  onOpenSaved: () => void
  onOpenSearch: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onAddChild: () => void
  onAddSibling: () => void
  onAddFree: () => void
  onConnect: () => void
  onExportJson: () => void
  onExportPng: () => void
  onClear: () => void
}

export function MinimalHeader(props: MinimalHeaderProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMoreOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [])

  return (
    <header className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs">
      <button className="rounded-lg bg-[#8b82ff]/20 px-3 py-1.5 font-medium text-[#d6d1ff]" onClick={props.onGenerate}>
        {props.generating ? 'Generating…' : 'Generate Ideas'}
      </button>

      <select
        value={props.mode}
        onChange={(e) => props.onModeChange(e.target.value as IdeaEngineSettings['mode'])}
        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-slate-300"
      >
        <option value="creative">Creative</option>
        <option value="business">Business</option>
        <option value="action">Action</option>
        <option value="questions">Questions</option>
        <option value="contrarian">Contrarian</option>
      </select>

      <button className="ml-auto rounded-lg border border-white/10 px-2 py-1.5 text-slate-300" onClick={props.onUndo} disabled={!props.canUndo}>↶</button>
      <button className="rounded-lg border border-white/10 px-2 py-1.5 text-slate-300" onClick={props.onRedo} disabled={!props.canRedo}>↷</button>
      <button className="rounded-lg border border-white/10 px-2 py-1.5 text-slate-300" onClick={props.onOpenSearch}>⌕</button>
      <button className="rounded-lg border border-white/10 px-2 py-1.5 text-slate-300" onClick={props.onOpenSaved}>Library</button>

      <div className="relative" ref={menuRef}>
        <button className="rounded-lg border border-white/10 px-2 py-1.5 text-slate-300" onClick={() => setMoreOpen((v) => !v)}>⋯ More</button>
        {moreOpen && (
          <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-white/10 bg-[#111525] p-1.5 shadow-xl">
            {([
              { label: 'Add child', action: props.onAddChild },
              { label: 'Add sibling', action: props.onAddSibling },
              { label: 'Free node', action: props.onAddFree },
              { label: 'Connect selected', action: props.onConnect },
              { label: 'Export JSON', action: props.onExportJson },
              { label: 'Export PNG', action: props.onExportPng },
              { label: 'Clear tree', action: props.onClear },
            ]).map((item) => (
              <button key={item.label} className="block w-full rounded-md px-2 py-1.5 text-left text-slate-300 hover:bg-white/10" onClick={() => { setMoreOpen(false); item.action() }}>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
