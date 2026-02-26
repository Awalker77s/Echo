import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computeEffectiveStreak,
  getMsUntilMidnight,
  getTodayString,
  getYesterdayString,
} from './useStreak'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDate(dateStr: string, time = '10:00:00'): Date {
  return new Date(`${dateStr}T${time}`)
}

// ---------------------------------------------------------------------------
// getTodayString / getYesterdayString
// ---------------------------------------------------------------------------

describe('getTodayString', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns YYYY-MM-DD in local time', () => {
    vi.setSystemTime(makeDate('2024-06-15'))
    expect(getTodayString()).toBe('2024-06-15')
  })

  it('accounts for month/day padding', () => {
    vi.setSystemTime(makeDate('2024-01-07'))
    expect(getTodayString()).toBe('2024-01-07')
  })
})

describe('getYesterdayString', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns the day before today', () => {
    vi.setSystemTime(makeDate('2024-06-15'))
    expect(getYesterdayString()).toBe('2024-06-14')
  })

  it('handles month boundary correctly', () => {
    vi.setSystemTime(makeDate('2024-03-01'))
    expect(getYesterdayString()).toBe('2024-02-29') // 2024 is a leap year
  })
})

// ---------------------------------------------------------------------------
// getMsUntilMidnight
// ---------------------------------------------------------------------------

describe('getMsUntilMidnight', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns ~0 when just before midnight', () => {
    vi.setSystemTime(new Date('2024-06-15T23:59:59.900'))
    const ms = getMsUntilMidnight()
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThan(200)
  })

  it('returns close to 24 hours when just after midnight', () => {
    vi.setSystemTime(new Date('2024-06-15T00:00:01.000'))
    const ms = getMsUntilMidnight()
    const expectedMs = 24 * 60 * 60 * 1000 - 1000
    expect(ms).toBeGreaterThan(expectedMs - 100)
    expect(ms).toBeLessThan(expectedMs + 100)
  })
})

// ---------------------------------------------------------------------------
// computeEffectiveStreak — core business logic
// ---------------------------------------------------------------------------

describe('computeEffectiveStreak', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns streak and completedToday=true when lastActionDate is today', () => {
    vi.setSystemTime(makeDate('2024-06-15'))
    const result = computeEffectiveStreak({
      currentStreak: 7,
      longestStreak: 10,
      lastActionDate: '2024-06-15',
    })
    expect(result.effectiveStreak).toBe(7)
    expect(result.completedToday).toBe(true)
  })

  it('keeps streak alive and marks completedToday=false when lastActionDate is yesterday', () => {
    vi.setSystemTime(makeDate('2024-06-15'))
    const result = computeEffectiveStreak({
      currentStreak: 5,
      longestStreak: 8,
      lastActionDate: '2024-06-14',
    })
    expect(result.effectiveStreak).toBe(5)
    expect(result.completedToday).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Midnight-rollover reset case (the key edge-case required by the spec)
  // -------------------------------------------------------------------------

  it('midnight-rollover reset: resets streak to 0 when user missed yesterday', () => {
    // It is now 00:05 on June 15.  The user last acted on June 13 (i.e. they
    // missed all of June 14).  Their streak must show 0.
    vi.setSystemTime(new Date('2024-06-15T00:05:00'))
    const result = computeEffectiveStreak({
      currentStreak: 12,
      longestStreak: 12,
      lastActionDate: '2024-06-13', // two days ago — missed June 14
    })
    expect(result.effectiveStreak).toBe(0)
    expect(result.completedToday).toBe(false)
  })

  it('midnight-rollover: streak survives a rollover when completed just before midnight', () => {
    // User completed action on June 14 (before midnight).
    // It is now 00:01 on June 15 — the streak should still be alive (5),
    // waiting for today's action.
    vi.setSystemTime(new Date('2024-06-15T00:01:00'))
    const result = computeEffectiveStreak({
      currentStreak: 5,
      longestStreak: 5,
      lastActionDate: '2024-06-14',
    })
    expect(result.effectiveStreak).toBe(5)
    expect(result.completedToday).toBe(false)
  })

  it('returns effectiveStreak=0 and completedToday=false for a brand-new user', () => {
    vi.setSystemTime(makeDate('2024-06-15'))
    const result = computeEffectiveStreak({
      currentStreak: 0,
      longestStreak: 0,
      lastActionDate: '',
    })
    expect(result.effectiveStreak).toBe(0)
    expect(result.completedToday).toBe(false)
  })

  it('resets to 0 when away for multiple days (2+ days gap)', () => {
    vi.setSystemTime(makeDate('2024-06-20'))
    const result = computeEffectiveStreak({
      currentStreak: 30,
      longestStreak: 30,
      lastActionDate: '2024-06-15', // 5 days ago
    })
    expect(result.effectiveStreak).toBe(0)
    expect(result.completedToday).toBe(false)
  })

  it('does not double-count if action was logged today before a re-render', () => {
    // Simulates a component re-render after midnight when the user already
    // logged today's action.
    vi.setSystemTime(makeDate('2024-06-15'))
    const result = computeEffectiveStreak({
      currentStreak: 8,
      longestStreak: 8,
      lastActionDate: '2024-06-15', // same as today
    })
    // effectiveStreak must stay at 8, not 9
    expect(result.effectiveStreak).toBe(8)
    expect(result.completedToday).toBe(true)
  })
})
