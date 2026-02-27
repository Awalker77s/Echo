export type Plan = 'free' | 'core' | 'memoir' | 'lifetime'

export type MoodLevel = 'Extremely Positive' | 'Positive' | 'Neutral' | 'Negative' | 'Extremely Negative'

export interface JournalEntry {
  id: string
  entry_title: string
  cleaned_entry: string
  raw_transcript?: string
  audio_url: string
  mood_primary: string
  mood_score: number
  mood_tags: string[]
  mood_level?: MoodLevel
  themes: string[]
  duration_seconds: number
  recorded_at: string
  created_at?: string
}

export interface Idea {
  id: string
  entry_id?: string
  content: string
  category: string
  idea_type?: string
  details?: string
  is_starred?: boolean
  created_at?: string
}

export interface MoodPoint {
  id: string
  recorded_at: string
  mood_score: number
  mood_primary: string
  mood_level?: MoodLevel
}

export interface PatternEvidence {
  entry_id: string
  quote: string
}

export interface PatternInsight {
  id: string
  pattern_type: string
  description: string
  confidence: number
  evidence: PatternEvidence[]
  advice?: string
  surfaced_at: string
  dismissed: boolean
}

export interface Insight {
  id: string
  entry_id?: string
  content: string
  insight_type?: string
  created_at?: string
}

export interface ChapterReport {
  id: string
  month: string
  title: string
  narrative: string
  top_themes: string[]
  mood_summary: Record<string, unknown>
  growth_moments: Array<Record<string, unknown> | string>
  entry_count: number
  created_at: string
}

export interface GiftCode {
  id: string
  code: string
  plan: Plan
  redeemed_at: string | null
  created_at: string
}
export * from './ideaTree'
