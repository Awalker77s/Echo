-- AI feature enhancements: mood levels, richer ideas, pattern advice

-- Add 5-level mood classification to journal_entries and mood_history
alter table public.journal_entries add column if not exists mood_level text;
alter table public.mood_history add column if not exists mood_level text;

-- Add richer idea fields
alter table public.ideas add column if not exists idea_type text;
alter table public.ideas add column if not exists details text;

-- Add reflective advice to patterns
alter table public.patterns add column if not exists advice text;
