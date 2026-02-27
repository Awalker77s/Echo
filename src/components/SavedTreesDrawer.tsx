import { SavedTreesPanel } from './SavedTreesPanel'
import type { IdeaTree } from '../types'

export function SavedTreesDrawer({ open, trees, onClose, onLoad }: { open: boolean; trees: IdeaTree[]; onClose: () => void; onLoad: (id: string) => void }) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-30 bg-black/40" onClick={onClose}>
      <div className="absolute right-3 top-3 h-[calc(100%-24px)] w-80 rounded-xl border border-white/10 bg-[#111525] p-3" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Saved Trees</h3>
          <button className="text-slate-400" onClick={onClose}>✕</button>
        </div>
        <SavedTreesPanel trees={trees} onLoad={(id) => { onLoad(id); onClose() }} />
      </div>
    </div>
  )
}
