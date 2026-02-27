import { useCallback, useEffect, useState } from 'react'
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, type DragStartEvent, type DragEndEvent, useDroppable } from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import { ErrorState } from '../components/ErrorState'
import { FeatureGate } from '../components/FeatureGate'
import { InsightDetailPanel } from '../components/InsightDetailPanel'
import { InsightNeuralCanvas } from '../components/InsightNeuralCanvas'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { TimelinePanel } from '../components/TimelinePanel'
import { useUserPlan } from '../hooks/useUserPlan'
import { generateInsightsForEntry, type GeneratedInsight } from '../lib/generateInsightsForEntry'
import { supabase } from '../lib/supabase'
import type { JournalEntry } from '../types'

function DropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'insights-canvas-drop' })

  return (
    <div ref={setNodeRef} className="flex h-full w-full items-center justify-center">
      <motion.div
        className="flex flex-col items-center gap-4 text-center"
        animate={isOver ? { scale: 1.05 } : { scale: 1 }}
      >
        <div
          className={`flex h-32 w-32 items-center justify-center rounded-full border-2 border-dashed transition-colors ${
            isOver
              ? 'border-[#8b82ff] bg-[#8b82ff]/10'
              : 'border-white/[0.12] bg-white/[0.03]'
          }`}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isOver ? '#8b82ff' : '#475569'}
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-400">
            Drag a journal entry here
          </p>
          <p className="mt-1 text-xs text-slate-600">
            to generate insights
          </p>
        </div>
      </motion.div>
    </div>
  )
}

function DragOverlayCard({ entry }: { entry: JournalEntry }) {
  return (
    <div className="w-64 rounded-xl border border-[#8b82ff]/40 bg-[#161830] p-3 shadow-2xl shadow-[#8b82ff]/20">
      <h4 className="text-sm font-semibold text-gray-200">{entry.entry_title}</h4>
      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{entry.cleaned_entry}</p>
    </div>
  )
}

export function InsightsPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [droppedEntry, setDroppedEntry] = useState<JournalEntry | null>(null)
  const [insights, setInsights] = useState<GeneratedInsight[]>([])
  const [generating, setGenerating] = useState(false)
  const [selectedInsight, setSelectedInsight] = useState<GeneratedInsight | null>(null)
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null)

  const { plan, loading: planLoading, error: planError } = useUserPlan()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  useEffect(() => {
    async function loadEntries() {
      if (!supabase) {
        setError('Supabase is not configured.')
        setEntriesLoading(false)
        return
      }
      setEntriesLoading(true)
      const { data, error: queryError } = await supabase
        .from('journal_entries')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(200)
      if (queryError) {
        setError('Unable to load journal entries.')
      } else {
        setEntries((data as JournalEntry[]) ?? [])
      }
      setEntriesLoading(false)
    }
    void loadEntries()
  }, [])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const entry = entries.find((e) => e.id === event.active.id)
    if (entry) setActiveEntry(entry)
  }, [entries])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveEntry(null)
    if (!event.over || event.over.id !== 'insights-canvas-drop') return
    const entry = entries.find((e) => e.id === event.active.id)
    if (entry) {
      setDroppedEntry(entry)
      setInsights([])
    }
  }, [entries])

  const handleGenerate = useCallback(async () => {
    if (!droppedEntry) return
    setGenerating(true)
    setError(null)
    try {
      const text = droppedEntry.cleaned_entry || droppedEntry.raw_transcript || ''
      const result = await generateInsightsForEntry(text)
      setInsights(result)
    } catch (err) {
      setError('Generation failed: ' + (err instanceof Error ? err.message : String(err)))
    }
    setGenerating(false)
  }, [droppedEntry])

  const handleClear = useCallback(() => {
    setDroppedEntry(null)
    setInsights([])
    setSelectedInsight(null)
    setError(null)
  }, [])

  if (planLoading) return <LoadingSkeleton lines={6} />
  if (planError) return <ErrorState message={planError} />

  return (
    <FeatureGate userPlan={plan} requiredPlan="memoir" featureName="Insights">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <main className="neural-vault-layout -mx-4 -mt-6 md:-mx-6">
          <div className="flex h-[calc(100vh-64px)] flex-col md:flex-row">
            {/* Left panel — Timeline entries */}
            <div className="h-52 w-full shrink-0 md:h-full md:w-80">
              <TimelinePanel entries={entries} loading={entriesLoading} />
            </div>

            {/* Right panel — Neural canvas */}
            <div className="relative flex flex-1 flex-col overflow-hidden bg-[#0a0d1a]">
              {/* Header bar */}
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                    Insights
                  </h2>
                  <p className="text-[11px] text-slate-600">
                    Neural network insight generation
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {droppedEntry && !generating && insights.length === 0 && (
                    <motion.button
                      className="neural-generate-btn rounded-xl px-4 py-2 text-xs font-semibold text-white"
                      onClick={() => void handleGenerate()}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      Generate
                    </motion.button>
                  )}
                  {generating && (
                    <span className="text-xs text-[#8b82ff]">
                      Generating...
                    </span>
                  )}
                  {droppedEntry && (
                    <button
                      className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-slate-400 transition hover:border-white/[0.15] hover:text-white"
                      onClick={handleClear}
                    >
                      Clear canvas
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="border-b border-red-900/30 bg-red-950/30 px-5 py-2 text-xs text-red-400">
                  {error}
                </div>
              )}

              {/* Canvas area */}
              <div className="relative flex-1">
                <AnimatePresence mode="wait">
                  {!droppedEntry ? (
                    <motion.div
                      key="dropzone"
                      className="h-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <DropZone />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="canvas"
                      className="h-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <InsightNeuralCanvas
                        entryTitle={droppedEntry.entry_title}
                        insights={insights}
                        generating={generating}
                        onInsightClick={setSelectedInsight}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Insight type legend */}
                {insights.length > 0 && (
                  <motion.div
                    className="absolute bottom-4 left-4 flex flex-wrap gap-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                  >
                    {[
                      { label: 'Pattern', color: '#7c3aed' },
                      { label: 'Reflection', color: '#3b82f6' },
                      { label: 'Advice', color: '#22c55e' },
                      { label: 'Growth', color: '#14b8a6' },
                      { label: 'Warning', color: '#ef4444' },
                    ].map((cat) => (
                      <span
                        key={cat.label}
                        className="flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[10px] text-slate-300 backdrop-blur"
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.label}
                      </span>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {activeEntry ? <DragOverlayCard entry={activeEntry} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Insight detail side panel */}
      <InsightDetailPanel insight={selectedInsight} onClose={() => setSelectedInsight(null)} />
    </FeatureGate>
  )
}
