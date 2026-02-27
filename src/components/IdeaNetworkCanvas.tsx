import { useMemo, useRef, useState } from 'react'
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
  onDropEntry: (position: { x: number; y: number }) => void
  onViewportChange?: (viewport: Viewport) => void
}

export function IdeaNetworkCanvas({
  tree,
  selectedNodeIds,
  searchQuery,
  onNodeSelect,
  onNodeMove,
  onDropEntry,
  onViewportChange,
}: IdeaNetworkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const [panning, setPanning] = useState(false)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const pointerStart = useRef({ x: 0, y: 0, viewportX: 0, viewportY: 0, nodeX: 0, nodeY: 0 })

  function updateViewport(next: Viewport) {
    setViewport(next)
    onViewportChange?.(next)
  }

  function toCanvas(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - viewport.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.y) / viewport.zoom,
    }
  }

  const visibleNodes = useMemo(() => tree.nodes.filter((node) => !node.parentId || !tree.nodes.find((n) => n.id === node.parentId)?.collapsed), [tree.nodes])
  const query = searchQuery.toLowerCase().trim()

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#0a0d1a]"
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-node]')) return
        setPanning(true)
        pointerStart.current = { x: e.clientX, y: e.clientY, viewportX: viewport.x, viewportY: viewport.y, nodeX: 0, nodeY: 0 }
      }}
      onMouseMove={(e) => {
        if (draggingNodeId) {
          const x = pointerStart.current.nodeX + (e.clientX - pointerStart.current.x) / viewport.zoom
          const y = pointerStart.current.nodeY + (e.clientY - pointerStart.current.y) / viewport.zoom
          onNodeMove(draggingNodeId, x, y)
          return
        }
        if (!panning) return
        updateViewport({ ...viewport, x: pointerStart.current.viewportX + (e.clientX - pointerStart.current.x), y: pointerStart.current.viewportY + (e.clientY - pointerStart.current.y) })
      }}
      onMouseUp={() => {
        setPanning(false)
        setDraggingNodeId(null)
      }}
      onMouseLeave={() => {
        setPanning(false)
        setDraggingNodeId(null)
      }}
      onWheel={(e) => {
        e.preventDefault()
        const nextZoom = Math.max(0.4, Math.min(2, viewport.zoom + (e.deltaY > 0 ? -0.08 : 0.08)))
        updateViewport({ ...viewport, zoom: nextZoom })
      }}
      onDoubleClick={(e) => {
        const point = toCanvas(e.clientX, e.clientY)
        onDropEntry(point)
      }}
    >
      <svg className="absolute inset-0 h-full w-full opacity-[0.08]">
        <defs>
          <pattern id="idea-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#idea-grid)" />
      </svg>

      <div style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: 'top left' }} className="absolute inset-0">
        <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }}>
          {tree.edges.map((edge) => {
            const source = tree.nodes.find((n) => n.id === edge.source)
            const target = tree.nodes.find((n) => n.id === edge.target)
            if (!source || !target) return null
            return (
              <path
                key={edge.id}
                d={`M${source.x},${source.y} C${source.x + 90},${source.y} ${target.x - 90},${target.y} ${target.x},${target.y}`}
                fill="none"
                stroke="rgba(139,130,255,0.5)"
                strokeWidth="2"
                strokeDasharray="5 4"
              />
            )
          })}
        </svg>

        {visibleNodes.map((node) => {
          const selected = selectedNodeIds.includes(node.id)
          const highlighted = query && node.label.toLowerCase().includes(query)
          return (
            <NodeCard
              key={node.id}
              node={node}
              selected={selected}
              highlighted={!!highlighted}
              onPointerDown={(e) => {
                e.stopPropagation()
                const additive = e.shiftKey || e.metaKey || e.ctrlKey
                onNodeSelect(node.id, additive)
                setDraggingNodeId(node.id)
                pointerStart.current = { x: e.clientX, y: e.clientY, viewportX: viewport.x, viewportY: viewport.y, nodeX: node.x, nodeY: node.y }
              }}
            />
          )
        })}
      </div>

      <MiniMap tree={tree} selectedNodeIds={selectedNodeIds} />
    </div>
  )
}

function NodeCard({ node, selected, highlighted, onPointerDown }: { node: IdeaTreeNode; selected: boolean; highlighted: boolean; onPointerDown: (e: React.MouseEvent<HTMLDivElement>) => void }) {
  return (
    <div
      data-node
      onMouseDown={onPointerDown}
      className={`absolute w-44 cursor-pointer rounded-xl border px-3 py-2 text-xs text-gray-100 shadow-lg transition ${selected ? 'border-[#8b82ff] bg-[#171a33]' : 'border-white/10 bg-[#11152a]'} ${highlighted ? 'ring-2 ring-emerald-400/70' : ''}`}
      style={{ left: node.x - 88, top: node.y - 30 }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full px-2 py-0.5 text-[10px] uppercase" style={{ backgroundColor: `${node.color}33`, color: node.color }}>{node.category}</span>
        <span className="text-[10px] text-slate-400">{node.status}</span>
      </div>
      <p className="mt-1 line-clamp-3 text-[11px] leading-snug">{node.label}</p>
    </div>
  )
}

function MiniMap({ tree, selectedNodeIds }: { tree: IdeaTree; selectedNodeIds: string[] }) {
  if (!tree.nodes.length) return null
  const xs = tree.nodes.map((n) => n.x)
  const ys = tree.nodes.map((n) => n.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = Math.max(1, maxX - minX)
  const height = Math.max(1, maxY - minY)

  return (
    <div className="absolute bottom-3 right-3 h-28 w-40 rounded-lg border border-white/10 bg-black/40 p-2">
      <svg className="h-full w-full">
        {tree.nodes.map((node) => (
          <circle
            key={node.id}
            cx={((node.x - minX) / width) * 140 + 5}
            cy={((node.y - minY) / height) * 90 + 5}
            r={selectedNodeIds.includes(node.id) ? 3.5 : 2.5}
            fill={selectedNodeIds.includes(node.id) ? '#8b82ff' : '#94a3b8'}
          />
        ))}
      </svg>
    </div>
  )
}
