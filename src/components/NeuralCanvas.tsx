import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GeneratedIdea } from '../lib/generateIdeasForEntry'

const categoryColors: Record<string, { fill: string; glow: string; text: string }> = {
  business: { fill: '#7c3aed', glow: 'rgba(124,58,237,0.5)', text: '#c4b5fd' },
  creative: { fill: '#3b82f6', glow: 'rgba(59,130,246,0.5)', text: '#93c5fd' },
  goal: { fill: '#22c55e', glow: 'rgba(34,197,94,0.5)', text: '#86efac' },
  action: { fill: '#f97316', glow: 'rgba(249,115,22,0.5)', text: '#fdba74' },
  other: { fill: '#6b7280', glow: 'rgba(107,114,128,0.5)', text: '#d1d5db' },
}

interface PositionedIdea extends GeneratedIdea {
  id: string
  x: number
  y: number
  angle: number
}

interface NeuralCanvasProps {
  entryTitle: string
  ideas: GeneratedIdea[]
  generating: boolean
  onIdeaClick: (idea: GeneratedIdea) => void
}

export function NeuralCanvas({ entryTitle, ideas, generating, onIdeaClick }: NeuralCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const cx = dimensions.width / 2
  const cy = dimensions.height / 2

  const positionedIdeas: PositionedIdea[] = ideas.map((idea, i) => {
    const angle = (2 * Math.PI * i) / ideas.length - Math.PI / 2
    const radiusX = Math.min(dimensions.width * 0.33, 280)
    const radiusY = Math.min(dimensions.height * 0.33, 220)
    return {
      ...idea,
      id: `idea-${i}`,
      x: cx + Math.cos(angle) * radiusX,
      y: cy + Math.sin(angle) * radiusY,
      angle,
    }
  })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    })
  }, [dragging])

  const handleMouseUp = useCallback(() => {
    setDragging(false)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Background grid pattern */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.06]">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div
        style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
        className="absolute inset-0"
      >
        {/* SVG connection lines */}
        <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }}>
          <defs>
            {positionedIdeas.map((idea) => {
              const colors = categoryColors[idea.category] ?? categoryColors.other
              return (
                <linearGradient
                  key={`grad-${idea.id}`}
                  id={`grad-${idea.id}`}
                  x1={cx}
                  y1={cy}
                  x2={idea.x}
                  y2={idea.y}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#8b82ff" stopOpacity="0.8" />
                  <stop offset="100%" stopColor={colors.fill} stopOpacity="0.6" />
                </linearGradient>
              )
            })}
          </defs>

          <AnimatePresence>
            {positionedIdeas.map((idea, i) => (
              <motion.line
                key={idea.id}
                x1={cx}
                y1={cy}
                x2={idea.x}
                y2={idea.y}
                stroke={`url(#grad-${idea.id})`}
                strokeWidth="2"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
              />
            ))}
          </AnimatePresence>
        </svg>

        {/* Central node */}
        <motion.div
          data-node
          className="absolute flex items-center justify-center"
          style={{
            left: cx - 70,
            top: cy - 70,
            width: 140,
            height: 140,
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div
            className={`neural-central-node flex h-full w-full items-center justify-center rounded-full border-2 border-[#8b82ff]/60 bg-[#1a1535] p-4 text-center ${generating ? 'neural-pulse' : ''}`}
          >
            <span className="text-xs font-semibold leading-tight text-[#c4bdff]">
              {entryTitle.length > 60 ? entryTitle.slice(0, 60) + '…' : entryTitle}
            </span>
          </div>
        </motion.div>

        {/* Idea nodes */}
        <AnimatePresence>
          {positionedIdeas.map((idea, i) => {
            const colors = categoryColors[idea.category] ?? categoryColors.other
            return (
              <motion.div
                key={idea.id}
                data-node
                className="absolute cursor-pointer"
                style={{
                  left: idea.x - 64,
                  top: idea.y - 36,
                  width: 128,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 20,
                  delay: 0.2 + i * 0.12,
                }}
                onClick={() => onIdeaClick(idea)}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
              >
                <div
                  className="neural-idea-node rounded-2xl border px-3 py-2.5 text-center"
                  style={{
                    backgroundColor: `${colors.fill}22`,
                    borderColor: `${colors.fill}66`,
                    boxShadow: `0 0 20px ${colors.glow}, inset 0 1px 0 ${colors.fill}33`,
                  }}
                >
                  <span
                    className="mb-1 block text-[9px] font-bold uppercase tracking-widest"
                    style={{ color: colors.text }}
                  >
                    {idea.category}
                  </span>
                  <span className="block text-[11px] leading-snug text-gray-200">
                    {idea.content.length > 70 ? idea.content.slice(0, 70) + '…' : idea.content}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
