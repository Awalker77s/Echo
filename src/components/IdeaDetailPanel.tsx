import { motion, AnimatePresence } from 'framer-motion'
import type { GeneratedIdea } from '../lib/generateIdeasForEntry'

const categoryStyle: Record<string, { accent: string; bg: string; label: string }> = {
  business: { accent: '#c4b5fd', bg: '#7c3aed22', label: 'Business' },
  creative: { accent: '#93c5fd', bg: '#3b82f622', label: 'Creative' },
  goal: { accent: '#86efac', bg: '#22c55e22', label: 'Goal' },
  action: { accent: '#fdba74', bg: '#f9731622', label: 'Action' },
  other: { accent: '#d1d5db', bg: '#6b728022', label: 'Other' },
}

interface IdeaDetailPanelProps {
  idea: GeneratedIdea | null
  onClose: () => void
}

export function IdeaDetailPanel({ idea, onClose }: IdeaDetailPanelProps) {
  return (
    <AnimatePresence>
      {idea && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/[0.08] bg-[#0e1225]/95 backdrop-blur-xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] p-5">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                Idea Details
              </h3>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {(() => {
                const style = categoryStyle[idea.category] ?? categoryStyle.other
                return (
                  <div className="space-y-5">
                    <span
                      className="inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: style.accent, backgroundColor: style.bg }}
                    >
                      {style.label}
                    </span>

                    <div>
                      <h4 className="text-lg font-semibold leading-snug text-gray-100">
                        {idea.content}
                      </h4>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Type
                      </span>
                      <p className="text-sm text-slate-300">
                        {idea.idea_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Details
                      </span>
                      <p className="text-sm leading-relaxed text-slate-300">
                        {idea.details}
                      </p>
                    </div>
                  </div>
                )
              })()}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
