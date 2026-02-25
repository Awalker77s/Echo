import type { MockUser, MoodEntry } from '../types'

const tags: MoodEntry['primary_mood_tag'][] = [
  'calm','stressed','driven','low energy','optimistic','anxious','focused','disconnected','energized','melancholic',
  'content','overwhelmed','excited','uncertain','grateful','tense','reflective','motivated','drained','hopeful'
]

const now = Date.now()
export const mockEntries: MoodEntry[] = Array.from({ length: 14 }).map((_, i) => ({
  id: `entry-${i + 1}`,
  created_at: new Date(now - i * 2 * 24 * 60 * 60 * 1000).toISOString(),
  primary_mood_tag: tags[i % tags.length],
  secondary_mood_tag: tags[(i + 3) % tags.length],
  mood_score: [82,55,78,49,88,58,76,44,86,52,80,47,92,63][i],
  energy_score: [74,40,80,35,88,50,70,30,84,42,76,38,86,60][i],
  stress_score: [25,68,35,72,20,64,30,75,18,66,28,70,15,52][i],
  mood_summary: [
    'You seem grounded and clear-headed today.','You appear tense and carrying pressure.','You look driven with steady momentum.','Your energy feels low and inward.','You seem bright, open, and optimistic.','There is restlessness and anticipatory tension.',
    'You appear focused and task-oriented.','You seem emotionally distant right now.','Your signals suggest lively, high output energy.','There is a gentle heaviness in your expression.',
    'You look at ease and quietly satisfied.','You may be holding too many emotional threads.','Your tone feels upbeat and activated.','You seem uncertain but still engaged.'
  ][i],
  emotional_insight: 'Your current signals suggest a mix of emotional load and resilience. You are showing up, but your system may be asking for pacing and recovery.',
  reflection_paragraph: 'You are in a moment that deserves attention without judgment. Notice what feels heavy and what still feels steady. Naming both can help you move forward with more clarity and less friction.',
  thumbnail: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=120&fit=crop'
}))

export const mockUser: MockUser = { display_name: 'Alex', streak: 12, avg_score: 74, tier: 'free' }

export const weeklyChartData = [
  { day: 'Mon', mood_score: 68 },{ day: 'Tue', mood_score: 72 },{ day: 'Wed', mood_score: 64 },
  { day: 'Thu', mood_score: 77 },{ day: 'Fri', mood_score: 74 },{ day: 'Sat', mood_score: 81 },{ day: 'Sun', mood_score: 76 }
]

export const trend30DayData = Array.from({ length: 30 }).map((_, i) => ({
  day: `${i + 1}`,
  mood_score: 58 + Math.round(Math.sin(i / 3) * 10) + (i % 5),
  energy_score: 52 + Math.round(Math.cos(i / 4) * 9)
}))
