import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { CommandPalette } from '../components/CommandPalette'
import { ErrorState } from '../components/ErrorState'
import { FeatureGate } from '../components/FeatureGate'
import { IdeaNetworkCanvas } from '../components/IdeaNetworkCanvas'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { MinimalHeader } from '../components/MinimalHeader'
import { OnboardingTooltip } from '../components/OnboardingTooltip'
import { SavedTreesDrawer } from '../components/SavedTreesDrawer'
import { TimelinePanel } from '../components/TimelinePanel'
import { useIdeaTreeStore } from '../hooks/useIdeaTreeStore'
import { useUserPlan } from '../hooks/useUserPlan'
import { buildIdeaPrompt, generateIdeasFromContext } from '../lib/ideaEngine'
import { supabase } from '../lib/supabase'
import type { IdeaEngineSettings, IdeaTree, JournalEntry } from '../types'

const categoryOptions = ['business', 'creative', 'goal', 'action', 'other'] as const
const statusOptions = ['idea', 'task', 'question'] as const

function DropTargetLayer() {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-drop' })
  return <div ref={setNodeRef} className={`pointer-events-none absolute inset-0 transition ${isOver ? 'bg-[#8b82ff]/8' : ''}`} />
}

function DragOverlayCard({ entry }: { entry: JournalEntry }) {
  return <div className="w-64 rounded-xl border border-[#8b82ff]/40 bg-[#161830] p-3 text-xs text-slate-200">{entry.entry_title}</div>
}

const defaultEngine: IdeaEngineSettings = { mode: 'creative', creativity: 0.6, nodeCount: 4, depthLimit: 2 }

function makeThumbnail(tree: IdeaTree): string {
  const points = tree.nodes.slice(0, 18).map((n) => `<circle cx="${n.x % 180}" cy="${n.y % 90}" r="2" fill="#8b82ff" />`).join('')
  return `data:image/svg+xml;base64,${btoa(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 90'><rect width='180' height='90' fill='#090d1a'/>${points}</svg>`)}`
}

export function IdeasVaultPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null)
  const [savedOpen, setSavedOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [engine, setEngine] = useState(defaultEngine)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const [controlsMenuOpen, setControlsMenuOpen] = useState(false)
  const [isCompactControls, setIsCompactControls] = useState(false)
  const notesPopoverRef = useRef<HTMLDivElement>(null)
  const controlsRowRef = useRef<HTMLDivElement>(null)

  const { plan, loading: planLoading, error: planError } = useUserPlan()
  const store = useIdeaTreeStore()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const selectedNode = store.selectedNodes.length === 1 ? store.selectedNodes[0] : null
  const hasMultipleSelected = store.selectedNodes.length > 1

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

  useEffect(() => {
    if (!selectedNode) setNotesOpen(false)
  }, [selectedNode])

  useEffect(() => {
    if (!notesOpen) return
    function handlePointerDown(event: MouseEvent) {
      if (!notesPopoverRef.current?.contains(event.target as Node)) setNotesOpen(false)
    }
    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [notesOpen])

  useEffect(() => {
    const row = controlsRowRef.current
    if (!row) return

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? row.clientWidth
      setIsCompactControls(width < 1180)
      if (width >= 1180) setControlsMenuOpen(false)
    })

    observer.observe(row)
    return () => observer.disconnect()
  }, [])

  const handleDropEntry = useCallback((entry: JournalEntry, at?: { x: number; y: number }) => {
    const position = at ?? { x: 420, y: 260 }
    const root = store.currentTree.rootNodeId ? store.currentTree.nodes.find((n) => n.id === store.currentTree.rootNodeId) : null
    if (root && !confirm('A root exists. Replace root with this entry? Click Cancel to attach as child.')) {
      store.addNode({ label: entry.entry_title, x: root.x + 220, y: root.y + 40, parentId: root.id, sourceEntryIds: [entry.id], notes: entry.cleaned_entry, category: 'other' })
      store.updateTree((tree) => ({ ...tree, influencedEntryIds: Array.from(new Set([...tree.influencedEntryIds, entry.id])) }), false)
      return
    }
    if (root) store.deleteNodes([root.id])
    store.addNode({ label: entry.entry_title, x: position.x, y: position.y, category: 'other', sourceEntryIds: [entry.id], notes: entry.cleaned_entry })
    store.updateTree((tree) => ({ ...tree, title: entry.entry_title, tags: Array.from(new Set([...tree.tags, entry.mood_primary || 'journal'])), influencedEntryIds: Array.from(new Set([...tree.influencedEntryIds, entry.id])) }), false)
  }, [store])

  const generateFromSelection = useCallback(async () => {
    const anchor = selectedNode ?? store.currentTree.nodes.find((n) => n.id === store.currentTree.rootNodeId)
    if (!anchor) return
    setGenerating(true)
    try {
      const contextEntries = entries.filter((e) => store.currentTree.influencedEntryIds.includes(e.id)).map((e) => e.cleaned_entry).join('\n')
      const prompt = buildIdeaPrompt({ contextText: `${contextEntries}\nNodes: ${store.currentTree.nodes.map((n) => n.label).join(', ')}`, selectedLabels: store.selectedNodes.map((n) => n.label), settings: engine })
      const ideas = await generateIdeasFromContext(prompt, engine)
      for (const [index, idea] of ideas.entries()) {
        await new Promise((resolve) => setTimeout(resolve, 110))
        store.addNode({ label: idea.content, category: idea.category, notes: idea.details, parentId: anchor.id, x: anchor.x + 180 + (index % 2) * 30, y: anchor.y + (index - ideas.length / 2) * 65 })
      }
    } catch (err) {
      setError(`Generation failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setGenerating(false)
    }
  }, [engine, entries, selectedNode, store])

  const addChild = useCallback(() => {
    if (!selectedNode) return
    store.addNode({ label: 'New child', parentId: selectedNode.id, x: selectedNode.x + 180, y: selectedNode.y + 50 })
  }, [selectedNode, store])

  const addSibling = useCallback(() => {
    if (!selectedNode) return
    store.addNode({ label: 'New sibling', parentId: selectedNode.parentId, x: selectedNode.x + 160, y: selectedNode.y + 10 })
  }, [selectedNode, store])

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(store.currentTree, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${store.currentTree.title.replace(/\s+/g, '-').toLowerCase() || 'idea-tree'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [store.currentTree])

  const exportPng = useCallback(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 800
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#0a0d1a'; ctx.fillRect(0, 0, 1200, 800)
    store.currentTree.edges.forEach((e) => {
      const s = store.currentTree.nodes.find((n) => n.id === e.source)
      const t = store.currentTree.nodes.find((n) => n.id === e.target)
      if (!s || !t) return
      ctx.strokeStyle = 'rgba(148,163,184,0.5)'
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke()
    })
    store.currentTree.nodes.forEach((n) => {
      ctx.fillStyle = 'rgba(139,130,255,0.22)'; ctx.beginPath(); ctx.arc(n.x, n.y, 18, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#f1f5f9'; ctx.font = '12px sans-serif'; ctx.fillText(n.label.slice(0, 24), n.x + 22, n.y + 4)
    })
    const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'idea-tree.png'; a.click()
  }, [store.currentTree])

  const connectSelected = useCallback(() => {
    if (store.selectedNodes.length < 2) return
    const centerX = store.selectedNodes.reduce((a, n) => a + n.x, 0) / store.selectedNodes.length
    const centerY = store.selectedNodes.reduce((a, n) => a + n.y, 0) / store.selectedNodes.length
    const relation = store.addNode({ label: 'Connection idea', x: centerX, y: centerY + 90, category: 'creative', status: 'question' })
    store.selectedNodes.forEach((n) => store.addEdge(n.id, relation.id, 'relationship'))
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

  const commands = useMemo(() => [
    { label: 'Generate ideas', action: () => void generateFromSelection() },
    { label: 'Add child node', action: addChild },
    { label: 'Add sibling node', action: addSibling },
    { label: 'Connect selected', action: connectSelected },
    { label: 'Save tree', action: () => store.saveCurrentTree(store.currentTree.title, store.currentTree.tags) },
    { label: 'Load saved trees', action: () => setSavedOpen(true) },
    { label: 'Export JSON', action: exportJson },
    { label: 'Export PNG', action: exportPng },
  ], [addChild, addSibling, connectSelected, exportJson, exportPng, generateFromSelection, store])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen(true) }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); setSearchOpen(true) }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? store.redo() : store.undo() }
      if (event.key === 'Delete') store.deleteNodes(store.selectedNodeIds)
      if (event.key === 'Enter' && selectedNode) {
        const value = prompt('Rename node', selectedNode.label)
        if (value) store.upsertNode(selectedNode.id, { label: value })
      }
      if (event.key === 'Escape') { setPaletteOpen(false); setSavedOpen(false); setSearchOpen(false); setContextMenu(null); setNotesOpen(false); setControlsMenuOpen(false) }
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
            <div className="h-56 w-full shrink-0 border-r border-white/10 md:h-full md:w-80"><TimelinePanel entries={entries} loading={entriesLoading} /></div>

            <div className="flex min-w-0 flex-1 bg-[#0a0d1a]">
              <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
                <MinimalHeader
                  generating={generating}
                  mode={engine.mode}
                  onModeChange={(mode) => setEngine((v) => ({ ...v, mode }))}
                  onGenerate={() => void generateFromSelection()}
                  onOpenSaved={() => setSavedOpen(true)}
                  onOpenSearch={() => setSearchOpen((v) => !v)}
                  onUndo={store.undo}
                  onRedo={store.redo}
                  canUndo={store.canUndo}
                  canRedo={store.canRedo}
                  onAddChild={addChild}
                  onAddSibling={addSibling}
                  onAddFree={() => store.addNode({ label: 'Free node', x: 420, y: 260 })}
                  onConnect={connectSelected}
                  onExportJson={exportJson}
                  onExportPng={exportPng}
                  onClear={store.newTree}
                />

                <div
                  ref={controlsRowRef}
                  className="flex min-h-11 min-w-0 items-center gap-2 overflow-x-auto border-b border-white/10 px-4 py-2 pr-3 text-xs text-slate-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {selectedNode ? (
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        className="w-32 min-w-0 truncate rounded bg-white/5 px-2 py-1 text-slate-100 outline-none ring-0 placeholder:text-slate-500"
                        value={selectedNode.label}
                        onChange={(e) => store.upsertNode(selectedNode.id, { label: e.target.value })}
                        placeholder="Label"
                      />

                      <select className="app-select w-28 py-1" value={selectedNode.category} onChange={(e) => store.upsertNode(selectedNode.id, { category: e.target.value as typeof categoryOptions[number] })}>
                        {categoryOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>

                      <select className="app-select w-24 py-1" value={selectedNode.status} onChange={(e) => store.upsertNode(selectedNode.id, { status: e.target.value as typeof statusOptions[number] })}>
                        {statusOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>

                      <label className="flex items-center gap-1 text-slate-400">
                        <span>Importance</span>
                        <input type="range" min={1} max={5} value={selectedNode.importance} onChange={(e) => store.upsertNode(selectedNode.id, { importance: Number(e.target.value) })} className="w-20 accent-[#8b82ff]" />
                        <span className="w-3 text-[11px] text-slate-300">{selectedNode.importance}</span>
                      </label>

                      {!isCompactControls && (
                        <input
                          className="min-w-40 max-w-72 flex-1 truncate rounded bg-white/5 px-2 py-1 text-slate-100 outline-none placeholder:text-slate-500"
                          value={selectedNode.links.join(', ')}
                          onChange={(e) => store.upsertNode(selectedNode.id, { links: e.target.value.split(',').map((link) => link.trim()).filter(Boolean) })}
                          placeholder="Links (comma separated)"
                        />
                      )}

                      {!isCompactControls && <button className="rounded px-2 py-1 hover:bg-white/10" onClick={() => setNotesOpen(true)}>Notes</button>}
                      {!isCompactControls && <button className="rounded px-2 py-1 hover:bg-white/10" onClick={() => store.upsertNode(selectedNode.id, { pinned: !selectedNode.pinned })}>{selectedNode.pinned ? 'Unpin' : 'Pin'}</button>}
                      {!isCompactControls && <button className="rounded px-2 py-1 hover:bg-white/10" onClick={() => store.upsertNode(selectedNode.id, { collapsed: !selectedNode.collapsed })}>{selectedNode.collapsed ? 'Expand subtree' : 'Collapse subtree'}</button>}
                      {!isCompactControls && <button className="rounded px-2 py-1 hover:bg-white/10" onClick={() => store.duplicateNode(selectedNode.id)}>Duplicate</button>}
                      {!isCompactControls && <button className="rounded px-2 py-1 text-red-300 hover:bg-red-500/15" onClick={() => store.deleteNodes([selectedNode.id])}>Delete</button>}
                      {!isCompactControls && <button className="rounded bg-[#8b82ff]/20 px-2 py-1 text-[#d6d1ff] hover:bg-[#8b82ff]/30" onClick={() => void generateFromSelection()}>✨ Generate from node</button>}

                      {isCompactControls && (
                        <div className="relative ml-auto shrink-0">
                          <button className="rounded px-2 py-1 hover:bg-white/10" onClick={() => setControlsMenuOpen((open) => !open)} aria-label="More node actions">More ▾</button>
                          {controlsMenuOpen && (
                            <div className="absolute right-0 top-8 z-30 w-52 rounded-lg border border-white/10 bg-[#111525] p-1 text-xs shadow-xl">
                              <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={() => { setNotesOpen(true); setControlsMenuOpen(false) }}>Notes</button>
                              <div className="px-2 py-1 text-[11px] text-slate-400">Links</div>
                              <input
                                className="mx-2 mb-2 block min-w-40 max-w-72 rounded bg-white/5 px-2 py-1 text-slate-100 outline-none placeholder:text-slate-500"
                                value={selectedNode.links.join(', ')}
                                onChange={(e) => store.upsertNode(selectedNode.id, { links: e.target.value.split(',').map((link) => link.trim()).filter(Boolean) })}
                                placeholder="comma separated"
                              />
                              <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={() => { store.upsertNode(selectedNode.id, { pinned: !selectedNode.pinned }); setControlsMenuOpen(false) }}>{selectedNode.pinned ? 'Unpin' : 'Pin'}</button>
                              <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={() => { store.upsertNode(selectedNode.id, { collapsed: !selectedNode.collapsed }); setControlsMenuOpen(false) }}>{selectedNode.collapsed ? 'Expand subtree' : 'Collapse subtree'}</button>
                              <button className="block w-full rounded px-2 py-1 text-left hover:bg-white/10" onClick={() => { store.duplicateNode(selectedNode.id); setControlsMenuOpen(false) }}>Duplicate</button>
                              <button className="block w-full rounded px-2 py-1 text-left text-red-300 hover:bg-red-500/15" onClick={() => { store.deleteNodes([selectedNode.id]); setControlsMenuOpen(false) }}>Delete</button>
                              <button className="mt-1 block w-full rounded bg-[#8b82ff]/20 px-2 py-1 text-left text-[#d6d1ff] hover:bg-[#8b82ff]/30" onClick={() => { void generateFromSelection(); setControlsMenuOpen(false) }}>✨ Generate from node</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : hasMultipleSelected ? (
                    <>
                      <span className="text-slate-400">Multiple selected</span>
                      <button className="rounded px-2 py-1 hover:bg-white/10" onClick={connectSelected}>Connect selected</button>
                      <button className="rounded px-2 py-1 text-red-300 hover:bg-red-500/15" onClick={() => store.deleteNodes(store.selectedNodeIds)}>Delete selected</button>
                    </>
                  ) : (
                    <span className="text-slate-500">Select a node to edit details</span>
                  )}
                </div>

                {searchOpen && (
                  <div className="absolute left-1/2 top-14 z-20 -translate-x-1/2 rounded-lg border border-white/10 bg-[#111525] p-2">
                    <input autoFocus className="w-64 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-100" placeholder="Search nodes…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                )}

                {error && <div className="border-b border-red-900/30 bg-red-950/30 px-4 py-1 text-xs text-red-400">{error}</div>}

                <div className="relative flex-1">
                  <DropTargetLayer />
                  {!store.currentTree.nodes.length ? (
                    <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">Drag an entry → Generate ideas → Save tree.</div>
                  ) : (
                    <IdeaNetworkCanvas
                      tree={store.currentTree}
                      selectedNodeIds={store.selectedNodeIds}
                      searchQuery={searchQuery}
                      onNodeSelect={store.setNodeSelection}
                      onNodeMove={(nodeId, x, y) => store.upsertNode(nodeId, { x, y })}
                      onCanvasDoubleClick={(position) => store.addNode({ label: 'Free node', x: position.x, y: position.y })}
                      onNodeDoubleClick={(node) => {
                        store.setNodeSelection(node.id, false)
                        setNotesOpen(true)
                      }}
                      onNodeContextMenu={(_node, point) => setContextMenu(point)}
                      onQuickAddChild={addChild}
                      onQuickGenerate={() => void generateFromSelection()}
                    />
                  )}

                  {contextMenu && (
                    <div className="absolute z-30 w-40 rounded-lg border border-white/10 bg-[#111525] p-1 text-xs" style={{ left: contextMenu.x - 180, top: contextMenu.y - 70 }}>
                      <button className="block w-full rounded px-2 py-1 text-left text-slate-300 hover:bg-white/10" onClick={() => { addChild(); setContextMenu(null) }}>Add child</button>
                      <button className="block w-full rounded px-2 py-1 text-left text-slate-300 hover:bg-white/10" onClick={() => { void generateFromSelection(); setContextMenu(null) }}>Generate</button>
                      <button className="block w-full rounded px-2 py-1 text-left text-slate-300 hover:bg-white/10" onClick={() => { store.deleteNodes(store.selectedNodeIds); setContextMenu(null) }}>Delete</button>
                    </div>
                  )}

                  <OnboardingTooltip />

                  {notesOpen && selectedNode && (
                    <div className="absolute inset-x-0 top-20 z-30 flex justify-center px-4">
                      <div ref={notesPopoverRef} className="w-full max-w-md rounded-xl border border-white/10 bg-[#111525]/95 p-4 shadow-2xl">
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-sm font-medium text-slate-100">{selectedNode.label}</h3>
                          <button className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/10" onClick={() => setNotesOpen(false)}>Close</button>
                        </div>
                        <textarea
                          autoFocus
                          value={selectedNode.notes}
                          onChange={(e) => store.upsertNode(selectedNode.id, { notes: e.target.value })}
                          className="h-36 w-full resize-none rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-100 outline-none"
                          placeholder="Add notes / description"
                        />
                        <div className="mt-3 flex justify-end">
                          <button className="rounded bg-[#8b82ff]/20 px-3 py-1 text-xs text-[#d6d1ff] hover:bg-[#8b82ff]/30" onClick={() => setNotesOpen(false)}>Save</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </main>

        <SavedTreesDrawer open={savedOpen} trees={store.library.map((tree) => ({ ...tree, thumbnail: tree.thumbnail || makeThumbnail(tree) }))} onClose={() => setSavedOpen(false)} onLoad={store.loadTree} />
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />

        <DragOverlay dropAnimation={null}>{activeEntry ? <DragOverlayCard entry={activeEntry} /> : null}</DragOverlay>
      </DndContext>
    </FeatureGate>
  )
}
