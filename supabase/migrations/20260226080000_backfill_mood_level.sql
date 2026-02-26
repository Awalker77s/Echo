-- Ensure all columns added by the ai_feature_enhancements migration exist,
-- and backfill mood_level from mood_score for any existing NULL rows.
-- All statements use IF NOT EXISTS so this migration is safe to re-run.

-- ── mood_history ──────────────────────────────────────────────────────────────
alter table public.mood_history add column if not exists mood_level text;

-- Backfill rows where mood_level is missing (inserted before this column existed).
-- mood_score is a float from -1 (most negative) to +1 (most positive).
update public.mood_history
set mood_level = case
  when mood_score >= 0.6  then 'Extremely Positive'
  when mood_score >= 0.2  then 'Positive'
  when mood_score >= -0.2 then 'Neutral'
  when mood_score >= -0.6 then 'Negative'
  else                         'Extremely Negative'
end
where mood_level is null and mood_score is not null;

-- ── journal_entries ───────────────────────────────────────────────────────────
alter table public.journal_entries add column if not exists mood_level text;

update public.journal_entries
set mood_level = case
  when mood_score >= 0.6  then 'Extremely Positive'
  when mood_score >= 0.2  then 'Positive'
  when mood_score >= -0.2 then 'Neutral'
  when mood_score >= -0.6 then 'Negative'
  else                         'Extremely Negative'
end
where mood_level is null and mood_score is not null;

-- ── ideas ─────────────────────────────────────────────────────────────────────
-- idea_type and details are inserted by process-recording; if the columns are
-- missing the entire recording pipeline fails.
alter table public.ideas add column if not exists idea_type text;
alter table public.ideas add column if not exists details text;

-- ── patterns ──────────────────────────────────────────────────────────────────
-- advice is inserted by pattern-recognition; missing column would break that fn.
alter table public.patterns add column if not exists advice text;
