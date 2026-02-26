import { AnimatePresence, motion } from 'framer-motion'
import { useStreak } from '../hooks/useStreak'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  parts.push(`${String(s).padStart(2, '0')}s`)
  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Displays the current day-streak, the all-time best streak, a countdown to
 * midnight when the daily action hasn't been logged yet, and a "logged today"
 * badge once it has.
 *
 * Consumes useStreak() directly; no props required.  If the parent also needs
 * logAction() it should call useStreak() separately — the module-level store
 * keeps all instances in sync.
 */
export function StreakDisplay() {
  const { currentStreak, longestStreak, completedToday, secondsUntilMidnight } =
    useStreak()

  const streakLabel =
    currentStreak === 1 ? '1 day streak' : `${currentStreak} day streak`

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* ── Current streak badge ── */}
      <div className="flex items-center gap-1.5 rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-medium text-[var(--muted)] dark:border dark:border-gray-700">
        <span role="img" aria-label="flame">
          🔥
        </span>

        {/* AnimatePresence animates the number when it changes */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={currentStreak}
            initial={{ opacity: 0, y: -10, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.7 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            {streakLabel}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* ── Personal best (only once there's a history) ── */}
      {longestStreak > 0 && (
        <span className="soft-pill" title="Your longest streak">
          🏆 Best: {longestStreak}d
        </span>
      )}

      {/* ── Status: countdown or "logged today" ── */}
      {completedToday ? (
        <span
          className="soft-pill"
          style={{ color: 'var(--success)' }}
          title="Today's journal entry is logged"
        >
          ✓ Logged today
        </span>
      ) : (
        currentStreak > 0 && (
          <span
            className="soft-pill tabular-nums"
            title="Time remaining to log today's entry before the streak resets"
          >
            ⏱ {formatCountdown(secondsUntilMidnight)}
          </span>
        )
      )}
    </div>
  )
}
