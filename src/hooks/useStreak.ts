import { useCallback, useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

export interface StreakData {
  currentStreak: number
  longestStreak: number
  /** ISO date-only string (YYYY-MM-DD). Empty string if the user has never acted. */
  lastActionDate: string
}

export interface StreakState {
  /** Effective streak (0 if user missed a day). */
  currentStreak: number
  longestStreak: number
  /** True when lastActionDate equals today in local timezone. */
  completedToday: boolean
  /** Seconds remaining until local midnight (and streak deadline). */
  secondsUntilMidnight: number
  /** Call this when the user completes the daily action. Safe to call multiple times. */
  logAction: () => void
}

// ---------------------------------------------------------------------------
// Pure date utilities  (exported so tests can import them directly)
// ---------------------------------------------------------------------------

/** Returns today's date as YYYY-MM-DD in the user's local timezone. */
export function getTodayString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Returns yesterday's date as YYYY-MM-DD in the user's local timezone. */
export function getYesterdayString(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/** Milliseconds until the next local midnight. */
export function getMsUntilMidnight(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  return midnight.getTime() - now.getTime()
}

/**
 * Derives the effective streak values from stored data.
 *
 * Rules:
 *  - lastActionDate === today       → completedToday, streak unchanged
 *  - lastActionDate === yesterday   → streak still alive, today not logged yet
 *  - lastActionDate < yesterday     → streak is broken (reset to 0)
 *  - lastActionDate empty/null      → never started (streak = 0)
 */
export function computeEffectiveStreak(data: StreakData): {
  effectiveStreak: number
  completedToday: boolean
} {
  const today = getTodayString()
  const yesterday = getYesterdayString()

  if (data.lastActionDate === today) {
    return { effectiveStreak: data.currentStreak, completedToday: true }
  }

  if (data.lastActionDate === yesterday) {
    // Waiting for today's action — streak is still alive
    return { effectiveStreak: data.currentStreak, completedToday: false }
  }

  // Missed at least one day (or no history)
  return { effectiveStreak: 0, completedToday: false }
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'echo_streak'

function loadData(): StreakData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as StreakData
  } catch {
    // ignore malformed data
  }
  return { currentStreak: 0, longestStreak: 0, lastActionDate: '' }
}

function saveData(data: StreakData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// ---------------------------------------------------------------------------
// Module-level shared store
//
// All instances of useStreak() share a single in-memory snapshot and a single
// midnight timer.  When logAction() or the midnight timer fires, every
// subscribed component re-renders atomically.
// ---------------------------------------------------------------------------

let _storeData: StreakData = loadData()
let _midnightTimer: ReturnType<typeof setTimeout> | null = null
const _listeners = new Set<(data: StreakData) => void>()

function _updateStore(data: StreakData): void {
  _storeData = data
  _listeners.forEach((fn) => fn(data))
}

function _scheduleMidnightRollover(): void {
  if (_midnightTimer !== null) return // already scheduled

  const ms = getMsUntilMidnight()
  _midnightTimer = setTimeout(() => {
    _midnightTimer = null
    // Re-read from localStorage (handles the case where the user completed the
    // action just before midnight — we must not double-count on rollover).
    _updateStore(loadData())
    _scheduleMidnightRollover()
  }, ms + 150) // 150 ms buffer to land safely past midnight
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStreak(): StreakState {
  const [stored, setStored] = useState<StreakData>(_storeData)
  const [secondsUntilMidnight, setSecondsUntilMidnight] = useState(() =>
    Math.ceil(getMsUntilMidnight() / 1000),
  )

  useEffect(() => {
    // Subscribe to shared store updates (e.g. from another component calling logAction)
    _listeners.add(setStored)

    // Ensure the module-level midnight timer is running
    _scheduleMidnightRollover()

    // Countdown — update every second so the UI stays current
    const countdownInterval = setInterval(() => {
      setSecondsUntilMidnight(Math.ceil(getMsUntilMidnight() / 1000))
    }, 1000)

    return () => {
      _listeners.delete(setStored)
      clearInterval(countdownInterval)
      // Do NOT clear _midnightTimer here — it should persist at module scope
      // for as long as any component is mounted.
    }
  }, [])

  const logAction = useCallback(() => {
    // Read directly from the module-level snapshot to avoid stale closures and
    // to prevent double-counting if the component re-renders around midnight.
    const current = _storeData
    const today = getTodayString()
    if (current.lastActionDate === today) return // already logged today

    const yesterday = getYesterdayString()
    const newStreak =
      current.lastActionDate === yesterday ? current.currentStreak + 1 : 1

    const updated: StreakData = {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, current.longestStreak),
      lastActionDate: today,
    }

    saveData(updated)
    _updateStore(updated)
  }, [])

  const { effectiveStreak, completedToday } = computeEffectiveStreak(stored)

  return {
    currentStreak: effectiveStreak,
    longestStreak: stored.longestStreak,
    completedToday,
    secondsUntilMidnight,
    logAction,
  }
}
