import type { IdeaTree } from '../types/ideaTree'

export function SavedTreesPanel({ trees, onLoad }: { trees: IdeaTree[]; onLoad: (id: string) => void }) {
  if (!trees.length) {
    return <p className="text-xs text-slate-500">No saved trees yet. Save your current network to build a reusable idea library.</p>
  }

  return (
    <div className="space-y-2">
      {trees.map((tree) => (
        <button key={tree.id} className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-left hover:border-[#8b82ff]/40" onClick={() => onLoad(tree.id)}>
          {tree.thumbnail && <img src={tree.thumbnail} alt={tree.title} className="mb-2 h-16 w-full rounded object-cover" />}
          <p className="text-xs font-semibold text-slate-100">{tree.title}</p>
          <p className="text-[10px] text-slate-500">Updated {new Date(tree.updatedAt).toLocaleString()}</p>
          <p className="mt-1 text-[10px] text-slate-400">{tree.tags.join(', ') || 'No tags'}</p>
        </button>
      ))}
    </div>
  )
}
