import { useEffect, useMemo, useRef, useState } from 'react'
import type { IdeaTree, IdeaTreeNode } from '../types/ideaTree'

interface Viewport {
  x: number
  y: number
  zoom: number
}

interface IdeaNetworkCanvasProps {
  tree: IdeaTree
  selectedNodeIds: string[]
  searchQuery: string
  onNodeSelect: (nodeId: string, additive: boolean) => void
  onNodeMove: (nodeId: string, x: number, y: number) => void
  onCanvasDoubleClick: (position: { x: number; y: number }) => void
  onNodeDoubleClick: (node: IdeaTreeNode) => void
  onNodeContextMenu: (node: IdeaTreeNode, point: { x: number; y: number }) => void
  onQuickAddChild: () => void
  onQuickGenerate: () => void
  layoutVersion?: number
}

export function IdeaNetworkCanvas({
  tree,
  selectedNodeIds,
  searchQuery,
  onNodeSelect,
  onNodeMove,
  onCanvasDoubleClick,
  onNodeDoubleClick,
  onNodeContextMenu,
  onQuickAddChild,
  onQuickGenerate,
  layoutVersion = 0,
}: IdeaNetworkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [panning, setPanning] = useState(false)
  const [spacePressed, setSpacePressed] = useState(false)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [pendingDragNodeId, setPendingDragNodeId] = useState<string | null>(null)
  const pointerStart = useRef({ x: 0, y: 0, viewportX: 0, viewportY: 0, nodeX: 0, nodeY: 0 })
  const nodeDragDistance = 6

  useEffect(() => {
    function down(e: KeyboardEvent) { if (e.code === 'Space') setSpacePressed(true) }
    function up(e: KeyboardEvent) { if (e.code === 'Space') setSpacePressed(false) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])



  useEffect(() => {
    const target = containerRef.current
    if (!target) return

    const observer = new ResizeObserver(() => {
      setViewport((v) => ({ ...v }))
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    fitView()
  }, [layoutVersion])

  function toCanvas(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: (clientX - rect.left - viewport.x) / viewport.zoom, y: (clientY - rect.top - viewport.y) / viewport.zoom }
  }

  function fitView() {
    if (!tree.nodes.length) return
    const xs = tree.nodes.map((n) => n.x)
    const ys = tree.nodes.map((n) => n.y)
    const minX = Math.min(...xs) - 120
    const maxX = Math.max(...xs) + 120
    const minY = Math.min(...ys) - 90
    const maxY = Math.max(...ys) + 90
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const zoom = Math.max(0.45, Math.min(1.25, Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY))))
    setViewport({ x: -minX * zoom + 20, y: -minY * zoom + 20, zoom })
  }

  const visibleNodes = useMemo(() => tree.nodes.filter((node) => !node.parentId || !tree.nodes.find((n) => n.id === node.parentId)?.collapsed), [tree.nodes])
  const selectedNode = tree.nodes.find((n) => selectedNodeIds.includes(n.id)) ?? null
  const query = searchQuery.toLowerCase().trim()

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#0a0d1a]"
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-node]') && !spacePressed) return
        setPanning(true)
        pointerStart.current = { x: e.clientX, y: e.clientY, viewportX: viewport.x, viewportY: viewport.y, nodeX: 0, nodeY: 0 }
      }}
      onMouseMove={(e) => {
        if (pendingDragNodeId && !draggingNodeId) {
          const distance = Math.hypot(e.clientX - pointerStart.current.x, e.clientY - pointerStart.current.y)
          if (distance >= nodeDragDistance) setDraggingNodeId(pendingDragNodeId)
        }

        if (draggingNodeId) {
          onNodeMove(
            draggingNodeId,
            pointerStart.current.nodeX + (e.clientX - pointerStart.current.x) / viewport.zoom,
            pointerStart.current.nodeY + (e.clientY - pointerStart.current.y) / viewport.zoom,
          )
          return
        }
        if (!panning) return
        setViewport((v) => ({ ...v, x: pointerStart.current.viewportX + (e.clientX - pointerStart.current.x), y: pointerStart.current.viewportY + (e.clientY - pointerStart.current.y) }))
      }}
      onMouseUp={() => { setPanning(false); setDraggingNodeId(null); setPendingDragNodeId(null) }}
      onMouseLeave={() => { setPanning(false); setDraggingNodeId(null); setPendingDragNodeId(null) }}
      onWheel={(e) => {
        e.preventDefault()
        if (e.ctrlKey) {
          const nextZoom = Math.max(0.4, Math.min(2, viewport.zoom + (e.deltaY > 0 ? -0.06 : 0.06)))
          setViewport((v) => ({ ...v, zoom: nextZoom }))
          return
        }
        setViewport((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
      }}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-node]')) return
        onCanvasDoubleClick(toCanvas(e.clientX, e.clientY))
      }}
    >
      <svg className="absolute inset-0 h-full w-full opacity-[0.05]"><defs><pattern id="idea-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" /></pattern></defs><rect width="100%" height="100%" fill="url(#idea-grid)" /></svg>

      <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
        <button className="rounded-md border border-white/10 bg-black/35 px-2 py-1 text-[11px] text-slate-300" onClick={fitView}>Fit view</button>
        <div className="rounded-md border border-white/10 bg-black/35 px-2 py-1 text-[11px] text-slate-400">Trackpad: scroll pan · pinch zoom · Space+drag pan</div>
      </div>

      <div style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: 'top left' }} className="absolute inset-0">
        <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }}>
          {tree.edges.map((edge) => {
            const source = tree.nodes.find((n) => n.id === edge.source)
            const target = tree.nodes.find((n) => n.id === edge.target)
            if (!source || !target) return null
            return <path key={edge.id} d={`M${source.x},${source.y} C${source.x + 90},${source.y} ${target.x - 90},${target.y} ${target.x},${target.y}`} fill="none" stroke="rgba(148,163,184,0.45)" strokeWidth="1.6" />
          })}
        </svg>

        {visibleNodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            selected={selectedNodeIds.includes(node.id)}
            highlighted={query ? node.label.toLowerCase().includes(query) : false}
            onPointerDown={(e) => {
              e.stopPropagation()
              onNodeSelect(node.id, e.shiftKey || e.metaKey || e.ctrlKey)
              if (spacePressed) return
              setPendingDragNodeId(node.id)
              pointerStart.current = { x: e.clientX, y: e.clientY, viewportX: viewport.x, viewportY: viewport.y, nodeX: node.x, nodeY: node.y }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onNodeDoubleClick(node)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              onNodeSelect(node.id, false)
              onNodeContextMenu(node, { x: e.clientX, y: e.clientY })
            }}
          />
        ))}

        {selectedNode && (
          <div className="absolute z-20 flex gap-1" style={{ left: selectedNode.x + 80, top: selectedNode.y - 52 }}>
            <button className="rounded-md border border-white/10 bg-[#111525] px-2 py-1 text-[11px] text-slate-200" onClick={onQuickAddChild}>+ Child</button>
            <button className="rounded-md border border-white/10 bg-[#111525] px-2 py-1 text-[11px] text-[#d6d1ff]" onClick={onQuickGenerate}>✨ Generate</button>
          </div>
        )}
      </div>
    </div>
  )
}

function NodeCard({ node, selected, highlighted, onPointerDown, onDoubleClick, onContextMenu }: {
  node: IdeaTreeNode
  selected: boolean
  highlighted: boolean
  onPointerDown: (e: React.MouseEvent<HTMLDivElement>) => void
  onDoubleClick: (e: React.MouseEvent<HTMLDivElement>) => void
  onContextMenu: (e: React.MouseEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      data-node
      onMouseDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={`absolute w-44 cursor-pointer rounded-xl border bg-[#111525]/95 px-3 py-2 text-xs text-gray-100 shadow-sm transition ${selected ? 'border-[#8b82ff]/60' : 'border-white/10'} ${highlighted ? 'ring-2 ring-emerald-400/60' : ''}`}
      style={{ left: node.x - 88, top: node.y - 30 }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full px-2 py-0.5 text-[10px] uppercase text-slate-300" style={{ backgroundColor: `${node.color}22` }}>{node.category}</span>
        <span className="text-[10px] text-slate-500">{node.status}</span>
      </div>
      <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-slate-200">{node.label}</p>
    </div>
  )
}
