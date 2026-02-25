export type MoodTag =
  | 'calm' | 'stressed' | 'driven' | 'low energy' | 'optimistic' | 'anxious'
  | 'focused' | 'disconnected' | 'energized' | 'melancholic' | 'content' | 'overwhelmed'
  | 'excited' | 'uncertain' | 'grateful' | 'tense' | 'reflective' | 'motivated' | 'drained' | 'hopeful'

export type Tier = 'free' | 'premium'

export interface MoodEntry {
  id: string
  created_at: string
  primary_mood_tag: MoodTag
  secondary_mood_tag: MoodTag
  mood_score: number
  energy_score: number
  stress_score: number
  mood_summary: string
  emotional_insight: string
  reflection_paragraph: string
  thumbnail?: string
}

export interface MockUser {
  display_name: string
  streak: number
  avg_score: number
  tier: Tier
}

export interface CheckinStatusResponse {
  entry_id: string
  status: 'processing' | 'complete' | 'failed'
  result: MoodEntry | null
}
