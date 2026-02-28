-- Add mood_reasoning to journal_entries and mood_history so the AI's
-- classification rationale is stored alongside the score, making future
-- debugging much easier (visible in Supabase logs and dashboard queries).

alter table public.journal_entries add column if not exists mood_reasoning text;
alter table public.mood_history    add column if not exists mood_reasoning text;
