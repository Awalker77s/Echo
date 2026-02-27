import { IdeaInspectorPanel } from './IdeaInspectorPanel'
import type { IdeaTreeNode } from '../types'

export function InspectorDrawer({
  open,
  node,
  onClose,
  onUpdate,
  onGenerate,
}: {
  open: boolean
  node: IdeaTreeNode | null
  onClose: () => void
  onUpdate: (patch: Partial<IdeaTreeNode>) => void
  onGenerate: () => void
}) {
  return (
    <aside className={`absolute right-0 top-0 z-20 h-full w-80 border-l border-white/10 bg-[#0d1120]/95 p-3 backdrop-blur transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Inspector</h3>
        <button className="text-slate-400" onClick={onClose}>✕</button>
      </div>
      {node && <button className="mb-3 w-full rounded-lg bg-[#8b82ff]/20 px-2 py-1.5 text-xs text-[#d6d1ff]" onClick={onGenerate}>✨ Generate from this node</button>}
      <IdeaInspectorPanel node={node} onUpdate={onUpdate} />
    </aside>
  )
}
