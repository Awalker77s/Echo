import { useCallback, useEffect, useMemo, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { ErrorState } from '../components/ErrorState'
import { FeatureGate } from '../components/FeatureGate'
import { IdeaInspectorPanel } from '../components/IdeaInspectorPanel'
import { IdeaNetworkCanvas } from '../components/IdeaNetworkCanvas'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { SavedTreesPanel } from '../components/SavedTreesPanel'
import { TimelinePanel } from '../components/TimelinePanel'
import { useIdeaTreeStore } from '../hooks/useIdeaTreeStore'
import { useUserPlan } from '../hooks/useUserPlan'
import { buildIdeaPrompt, generateIdeasFromContext } from '../lib/ideaEngine'
import { supabase } from '../lib/supabase'
import type { IdeaEngineSettings, IdeaTree, JournalEntry } from '../types'

function DropTargetLayer() {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-drop' })
  return <div ref={setNodeRef} className={`absolute inset-0 pointer-events-none transition ${isOver ? 'bg-[#8b82ff]/10' : ''}`} />
}

function DragOverlayCard({ entry }: { entry: JournalEntry }) {
  return <div className="w-64 rounded-xl border border-[#8b82ff]/40 bg-[#161830] p-3 text-xs text-slate-200">{entry.entry_title}</div>
}

const defaultEngine: IdeaEngineSettings = { mode: 'creative', creativity: 0.6, nodeCount: 4, depthLimit: 2 }

function makeThumbnail(tree: IdeaTree): string {
  const points = tree.nodes.slice(0, 18).map((n) => `<circle cx="${n.x % 180}" cy="${n.y % 90}" r="2" fill="#8b82ff" />`).join('')
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 90'><rect width='180' height='90' fill='#090d1a'/>${points}</svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export function IdeasVaultPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null)
  const [activeTab, setActiveTab] = useState<'inspector' | 'saved'>('inspector')
  const [searchNodes, setSearchNodes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [engine, setEngine] = useState(defaultEngine)

  const { plan, loading: planLoading, error: planError } = useUserPlan()
  const store = useIdeaTreeStore()

  const selectedNode = store.selectedNodes[0] ?? null
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    async function loadEntries() {
      if (!supabase) {
        setError('Supabase is not configured.')
        setEntriesLoading(false)
        return
      }
      const { data, error: queryError } = await supabase.from('journal_entries').select('*').order('recorded_at', { ascending: false }).limit(200)
      if (queryError) setError('Unable to load journal entries.')
      else setEntries((data as JournalEntry[]) ?? [])
      setEntriesLoading(false)
    }
    void loadEntries()
  }, [])

  const handleDropEntry = useCallback((entry: JournalEntry, at?: { x: number; y: number }) => {
    const position = at ?? { x: 420, y: 260 }
    const root = store.currentTree.rootNodeId ? store.currentTree.nodes.find((n) => n.id === store.currentTree.rootNodeId) : null
    if (!root) {
      store.addNode({ label: entry.entry_title, x: position.x, y: position.y, category: 'other', sourceEntryIds: [entry.id], notes: entry.cleaned_entry })
      store.updateTree((tree) => ({ ...tree, title: entry.entry_title, tags: Array.from(new Set([...tree.tags, entry.mood_primary || 'journal'])), influencedEntryIds: Array.from(new Set([...tree.influencedEntryIds, entry.id])) }), false)
      return
    }
    store.addNode({ label: entry.entry_title, x: root.x + 220, y: root.y + 40, parentId: root.id, sourceEntryIds: [entry.id], notes: entry.cleaned_entry, category: 'other' })
    store.updateTree((tree) => ({ ...tree, influencedEntryIds: Array.from(new Set([...tree.influencedEntryIds, entry.id])) }), false)
  }, [store])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const entry = entries.find((e) => e.id === event.active.id)
    if (entry) setActiveEntry(entry)
  }, [entries])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveEntry(null)
    if (!event.over || event.over.id !== 'canvas-drop') return
    const entry = entries.find((e) => e.id === event.active.id)
    if (entry) handleDropEntry(entry)
  }, [entries, handleDropEntry])

  const generateFromSelection = useCallback(async () => {
    if (!store.currentTree.nodes.length) return
    const contextEntries = entries.filter((e) => store.currentTree.influencedEntryIds.includes(e.id)).map((e) => e.cleaned_entry).join('\n')
    const selectedLabels = store.selectedNodes.map((n) => n.label)
    const fallbackNode = store.currentTree.nodes.find((n) => n.id === store.currentTree.rootNodeId)
    const anchor = store.selectedNodes[0] ?? fallbackNode
    if (!anchor) return

    setGenerating(true)
    try {
      const prompt = buildIdeaPrompt({ contextText: `${contextEntries}\nCurrent tree nodes: ${store.currentTree.nodes.map((n) => n.label).join(', ')}`, selectedLabels, settings: engine })
      const ideas = await generateIdeasFromContext(prompt, engine)
      for (const [index, idea] of ideas.entries()) {
        await new Promise((resolve) => setTimeout(resolve, 130))
        store.addNode({ label: idea.content, category: idea.category, notes: idea.details, parentId: anchor.id, x: anchor.x + 180 + (index % 2) * 40, y: anchor.y + (index - ideas.length / 2) * 72 })
      }
    } catch (err) {
      setError(`Generation failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setGenerating(false)
    }
  }, [engine, entries, store])

  const generateRelationships = useCallback(async () => {
    if (store.selectedNodes.length < 2) return
    const centerX = store.selectedNodes.reduce((acc, n) => acc + n.x, 0) / store.selectedNodes.length
    const centerY = store.selectedNodes.reduce((acc, n) => acc + n.y, 0) / store.selectedNodes.length
    const label = `Connection: ${store.selectedNodes.map((n) => n.label).join(' + ').slice(0, 70)}`
    const relationshipNode = store.addNode({ label, x: centerX, y: centerY + 100, category: 'creative', status: 'question' })
    for (const node of store.selectedNodes) {
      store.addEdge(node.id, relationshipNode.id, 'relationship')
    }
  }, [store])

  const handleExportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(store.currentTree, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${store.currentTree.title.replace(/\s+/g, '-').toLowerCase() || 'idea-tree'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [store.currentTree])

  const handleExportSvg = useCallback(() => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'><rect width='1200' height='800' fill='#0a0d1a'/>${store.currentTree.edges.map((e) => {
      const s = store.currentTree.nodes.find((n) => n.id === e.source)
      const t = store.currentTree.nodes.find((n) => n.id === e.target)
      if (!s || !t) return ''
      return `<line x1='${s.x}' y1='${s.y}' x2='${t.x}' y2='${t.y}' stroke='#8b82ff' stroke-opacity='0.6'/>`
    }).join('')}${store.currentTree.nodes.map((n) => `<g><circle cx='${n.x}' cy='${n.y}' r='20' fill='${n.color}' fill-opacity='0.35'/><text x='${n.x + 24}' y='${n.y + 4}' fill='white' font-size='12'>${n.label.slice(0, 28)}</text></g>`).join('')}</svg>`
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'idea-tree.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [store.currentTree])

  const handleExportPng = useCallback(() => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'><rect width='1200' height='800' fill='#0a0d1a'/></svg>`
    const img = new Image()
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 800
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      store.currentTree.edges.forEach((e) => {
        const s = store.currentTree.nodes.find((n) => n.id === e.source)
        const t = store.currentTree.nodes.find((n) => n.id === e.target)
        if (!s || !t) return
        ctx.strokeStyle = 'rgba(139,130,255,0.6)'
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke()
      })
      store.currentTree.nodes.forEach((n) => {
        ctx.fillStyle = 'rgba(139,130,255,0.3)'; ctx.beginPath(); ctx.arc(n.x, n.y, 18, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText(n.label.slice(0, 22), n.x + 22, n.y + 4)
      })
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = 'idea-tree.png'
      a.click()
    }
    img.src = `data:image/svg+xml;base64,${btoa(svg)}`
  }, [store.currentTree])

  const outlineMarkdown = useMemo(() => {
    if (!store.currentTree.rootNodeId) return ''
    const childrenByParent = new Map<string | null, string[]>()
    store.currentTree.nodes.forEach((node) => {
      const key = node.parentId
      childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), node.id])
    })
    const lines: string[] = []
    function walk(id: string, depth: number) {
      const node = store.currentTree.nodes.find((n) => n.id === id)
      if (!node) return
      lines.push(`${'  '.repeat(depth)}- ${node.label}`)
      for (const childId of childrenByParent.get(id) ?? []) walk(childId, depth + 1)
    }
    walk(store.currentTree.rootNodeId, 0)
    return lines.join('\n')
  }, [store.currentTree])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) store.redo(); else store.undo(); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); const input = document.getElementById('node-search'); input?.focus() }
      if (event.key === 'Delete') store.deleteNodes(store.selectedNodeIds)
      if (event.key.toLowerCase() === 'e' && selectedNode) setActiveTab('inspector')
      if (event.key.toLowerCase() === 'a' && selectedNode) store.addNode({ label: 'New child node', parentId: selectedNode.id, x: selectedNode.x + 180, y: selectedNode.y + 40 })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedNode, store])

  if (planLoading) return <LoadingSkeleton lines={6} />
  if (planError) return <ErrorState message={planError} />

  return (
    <FeatureGate userPlan={plan} requiredPlan="core" featureName="Ideas Vault">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <main className="neural-vault-layout -mx-4 -mt-6 md:-mx-6">
          <div className="flex h-[calc(100vh-64px)] flex-col md:flex-row">
            <div className="h-56 w-full shrink-0 md:h-full md:w-80"><TimelinePanel entries={entries} loading={entriesLoading} /></div>

            <div className="relative flex flex-1 flex-col overflow-hidden border-r border-white/10">
              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 text-xs">
                <button className="rounded bg-[#8b82ff]/20 px-3 py-1 text-[#c4bdff]" onClick={() => void generateFromSelection()}>{generating ? 'Generating…' : 'Generate Ideas'}</button>
                <button className="rounded bg-white/10 px-3 py-1" onClick={() => selectedNode && store.addNode({ label: 'Child idea', parentId: selectedNode.id, x: selectedNode.x + 180, y: selectedNode.y + 50 })}>Add child</button>
                <button className="rounded bg-white/10 px-3 py-1" onClick={() => selectedNode && store.addNode({ label: 'Sibling idea', parentId: selectedNode.parentId, x: selectedNode.x + 160, y: selectedNode.y + 10 })}>Add sibling</button>
                <button className="rounded bg-white/10 px-3 py-1" onClick={() => store.addNode({ label: 'Free node', x: 360, y: 260 })}>Free node</button>
                <button className="rounded bg-white/10 px-3 py-1" onClick={() => void generateRelationships()}>Connect selected</button>
                <button className="rounded bg-white/10 px-3 py-1" disabled={!store.canUndo} onClick={store.undo}>Undo</button>
                <button className="rounded bg-white/10 px-3 py-1" disabled={!store.canRedo} onClick={store.redo}>Redo</button>
                <button className="rounded bg-white/10 px-3 py-1" onClick={() => store.deleteNodes(store.selectedNodeIds)}>Delete</button>
                <button className="rounded bg-white/10 px-3 py-1" onClick={() => selectedNode && store.duplicateNode(selectedNode.id)}>Duplicate</button>
                <input id="node-search" className="ml-auto rounded border border-white/10 bg-white/5 px-2 py-1 text-xs" placeholder="Search nodes (⌘/Ctrl+F)" value={searchNodes} onChange={(e) => setSearchNodes(e.target.value)} />
              </div>

              <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2 text-xs">
                <select value={engine.mode} onChange={(e) => setEngine({ ...engine, mode: e.target.value as IdeaEngineSettings['mode'] })} className="rounded bg-white/5 px-2 py-1">
                  <option value="business">Business ideas</option><option value="creative">Creative angles</option><option value="action">Action steps</option><option value="questions">Questions to explore</option><option value="contrarian">Contrarian takes</option>
                </select>
                <label>Creativity <input type="range" min={0} max={1} step={0.1} value={engine.creativity} onChange={(e) => setEngine({ ...engine, creativity: Number(e.target.value) })} /></label>
                <label>Nodes <input type="number" min={1} max={10} className="w-12 rounded bg-white/5 px-1" value={engine.nodeCount} onChange={(e) => setEngine({ ...engine, nodeCount: Number(e.target.value) })} /></label>
                <label>Depth <input type="number" min={1} max={5} className="w-12 rounded bg-white/5 px-1" value={engine.depthLimit} onChange={(e) => setEngine({ ...engine, depthLimit: Number(e.target.value) })} /></label>
                <button className="ml-auto rounded bg-white/10 px-2 py-1" onClick={handleExportJson}>Export JSON</button>
                <button className="rounded bg-white/10 px-2 py-1" onClick={handleExportSvg}>SVG</button>
                <button className="rounded bg-white/10 px-2 py-1" onClick={handleExportPng}>PNG</button>
                <button className="rounded bg-white/10 px-2 py-1" onClick={() => navigator.clipboard.writeText(outlineMarkdown)}>Copy outline</button>
              </div>

              {error && <div className="border-b border-red-900/30 bg-red-950/30 px-4 py-1 text-xs text-red-400">{error}</div>}
              <div className="relative flex-1">
                <DropTargetLayer />
                {!store.currentTree.nodes.length ? (
                  <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">Drag a journal entry to seed your living idea network.<br />Tip: double click canvas to add a free node.</div>
                ) : (
                  <IdeaNetworkCanvas
                    tree={store.currentTree}
                    selectedNodeIds={store.selectedNodeIds}
                    searchQuery={searchNodes}
                    onNodeSelect={store.setNodeSelection}
                    onNodeMove={(nodeId, x, y) => store.upsertNode(nodeId, { x, y })}
                    onDropEntry={(position) => store.addNode({ label: 'Free node', x: position.x, y: position.y })}
                  />
                )}
              </div>
            </div>

            <aside className="w-full shrink-0 bg-[#0c0f1a] p-3 md:w-80">
              <div className="mb-3 flex gap-1 rounded-lg bg-white/5 p-1 text-xs">
                <button className={`flex-1 rounded py-1 ${activeTab === 'inspector' ? 'bg-[#8b82ff]/25 text-[#c4bdff]' : 'text-slate-400'}`} onClick={() => setActiveTab('inspector')}>Inspector</button>
                <button className={`flex-1 rounded py-1 ${activeTab === 'saved' ? 'bg-[#8b82ff]/25 text-[#c4bdff]' : 'text-slate-400'}`} onClick={() => setActiveTab('saved')}>Saved Trees</button>
              </div>

              {activeTab === 'inspector' ? (
                <div>
                  <IdeaInspectorPanel node={selectedNode} onUpdate={(patch) => selectedNode && store.upsertNode(selectedNode.id, patch)} />
                  <div className="mt-4 space-y-2 text-xs">
                    <input className="w-full rounded border border-white/10 bg-white/5 px-2 py-1" value={store.currentTree.title} onChange={(e) => store.setCurrentTree((tree) => ({ ...tree, title: e.target.value }))} placeholder="Tree title" />
                    <input className="w-full rounded border border-white/10 bg-white/5 px-2 py-1" value={store.currentTree.tags.join(', ')} onChange={(e) => store.setCurrentTree((tree) => ({ ...tree, tags: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) }))} placeholder="Tags" />
                    <button className="w-full rounded bg-[#8b82ff]/20 px-2 py-1 text-[#c4bdff]" onClick={() => store.saveCurrentTree(store.currentTree.title, store.currentTree.tags)}>Save tree</button>
                    <button className="w-full rounded bg-white/10 px-2 py-1" onClick={() => store.newTree()}>New tree</button>
                  </div>
                </div>
              ) : (
                <SavedTreesPanel trees={store.library.map((tree) => ({ ...tree, thumbnail: tree.thumbnail || makeThumbnail(tree) }))} onLoad={store.loadTree} />
              )}
            </aside>
          </div>
        </main>

        <DragOverlay dropAnimation={null}>{activeEntry ? <DragOverlayCard entry={activeEntry} /> : null}</DragOverlay>
      </DndContext>
    </FeatureGate>
  )
}
