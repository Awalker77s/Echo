import type { IdeaTreeNode } from '../types/ideaTree'

interface IdeaInspectorPanelProps {
  node: IdeaTreeNode | null
  onUpdate: (patch: Partial<IdeaTreeNode>) => void
}

export function IdeaInspectorPanel({ node, onUpdate }: IdeaInspectorPanelProps) {
  if (!node) {
    return <p className="text-xs text-slate-500">Select a node to edit title, notes, status, importance, links, and category.</p>
  }

  return (
    <div className="space-y-3 text-xs">
      <label className="block">
        <span className="text-slate-400">Label</span>
        <input className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-slate-100" value={node.label} onChange={(e) => onUpdate({ label: e.target.value })} />
      </label>
      <label className="block">
        <span className="text-slate-400">Category</span>
        <select className="app-select mt-1" value={node.category} onChange={(e) => onUpdate({ category: e.target.value as IdeaTreeNode['category'] })}>
          <option value="business">Business</option>
          <option value="creative">Creative</option>
          <option value="goal">Goal</option>
          <option value="action">Action</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="block">
        <span className="text-slate-400">Status</span>
        <select className="app-select mt-1" value={node.status} onChange={(e) => onUpdate({ status: e.target.value as IdeaTreeNode['status'] })}>
          <option value="idea">Idea</option>
          <option value="task">Task</option>
          <option value="question">Question</option>
        </select>
      </label>
      <label className="block">
        <span className="text-slate-400">Importance ({node.importance}/5)</span>
        <input type="range" min={1} max={5} value={node.importance} className="mt-1 w-full" onChange={(e) => onUpdate({ importance: Number(e.target.value) })} />
      </label>
      <label className="block">
        <span className="text-slate-400">Notes</span>
        <textarea className="mt-1 h-20 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-slate-100" value={node.notes} onChange={(e) => onUpdate({ notes: e.target.value })} />
      </label>
      <label className="block">
        <span className="text-slate-400">Links (comma separated)</span>
        <input className="mt-1 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-slate-100" value={node.links.join(', ')} onChange={(e) => onUpdate({ links: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} />
      </label>
      <div className="flex gap-2">
        <button className={`rounded px-2 py-1 ${node.pinned ? 'bg-[#8b82ff]/30 text-[#c4bdff]' : 'bg-white/10 text-slate-300'}`} onClick={() => onUpdate({ pinned: !node.pinned })}>Pin</button>
        <button className={`rounded px-2 py-1 ${node.collapsed ? 'bg-[#8b82ff]/30 text-[#c4bdff]' : 'bg-white/10 text-slate-300'}`} onClick={() => onUpdate({ collapsed: !node.collapsed })}>Collapse subtree</button>
      </div>
    </div>
  )
}
