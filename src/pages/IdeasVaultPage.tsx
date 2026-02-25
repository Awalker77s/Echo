import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Idea } from '../types'

const categories = ['all', 'business', 'creative', 'goal', 'action', 'other'] as const

export function IdeasVaultPage() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof categories)[number]>('all')
  const [starredOnly, setStarredOnly] = useState(false)
  const [bouncingId, setBouncingId] = useState<string | null>(null)

  async function load() {
    if (!supabase) return
    let q = supabase.from('ideas').select('*').order('created_at', { ascending: false }).limit(300)
    if (category !== 'all') q = q.eq('category', category)
    if (starredOnly) q = q.eq('is_starred', true)
    const { data } = await q
    if (data) setIdeas(data as Idea[])
  }

  useEffect(() => { void load() }, [category, starredOnly])

  const filtered = useMemo(() => {
    if (!query.trim()) return ideas
    const lowered = query.toLowerCase()
    return ideas.filter((idea) => idea.content.toLowerCase().includes(lowered))
  }, [ideas, query])

  async function toggleStar(idea: Idea) {
    if (!supabase) return
    setBouncingId(idea.id)
    await supabase.from('ideas').update({ is_starred: !idea.is_starred }).eq('id', idea.id)
    await load()
    window.setTimeout(() => setBouncingId(null), 260)
  }

  return (
    <main className="space-y-4">
      <h2 className="serif-reading text-3xl text-[#312b4e]">Ideas Vault</h2>
      <input className="app-card w-full px-4 py-3 text-sm outline-none" placeholder="Search ideas" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {categories.map((value) => (
          <button key={value} onClick={() => setCategory(value)} className={`soft-pill whitespace-nowrap capitalize ${category === value ? 'bg-[#e6e1fb] text-[#4a438b]' : ''}`}>
            {value}
          </button>
        ))}
        <button onClick={() => setStarredOnly((value) => !value)} className={`soft-pill whitespace-nowrap ${starredOnly ? 'bg-[#efe2ba] text-[#73561f]' : ''}`}>
          Starred only
        </button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {filtered.map((idea) => (
          <li key={idea.id} className="app-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm leading-relaxed text-[#3d4254]">{idea.content}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-[#7c8296]">{idea.category}</p>
              </div>
              <button
                onClick={() => void toggleStar(idea)}
                className="rounded-full bg-[#f3efe8] px-3 py-1 text-sm text-[#5e6380]"
                style={{ animation: bouncingId === idea.id ? 'bounce-star 220ms ease-in-out' : undefined }}
              >
                {idea.is_starred ? '★' : '☆'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
