-- Re-backfill mood_level using the tightened ±0.05 neutral band.
--
-- Previous backfill (20260226080000) used ±0.2, then code was tightened to ±0.1
-- in 20260228000000.  This migration corrects all stored mood_level values so they
-- match the current ±0.05 classification threshold used by the edge function and
-- the dashboard scoreMoodLevel() helper.
--
-- Only rows where the stored mood_level is inconsistent with the new thresholds are
-- updated, so rows that were already correct are left untouched.

-- ── journal_entries ──────────────────────────────────────────────────────────
update public.journal_entries
set mood_level = case
  when mood_score >= 0.7   then 'Extremely Positive'
  when mood_score >= 0.05  then 'Positive'
  when mood_score >= -0.05 then 'Neutral'
  when mood_score >= -0.7  then 'Negative'
  else                          'Extremely Negative'
end
where mood_score is not null
  and mood_level is distinct from (
    case
      when mood_score >= 0.7   then 'Extremely Positive'
      when mood_score >= 0.05  then 'Positive'
      when mood_score >= -0.05 then 'Neutral'
      when mood_score >= -0.7  then 'Negative'
      else                          'Extremely Negative'
    end
  );

-- ── mood_history ─────────────────────────────────────────────────────────────
update public.mood_history
set mood_level = case
  when mood_score >= 0.7   then 'Extremely Positive'
  when mood_score >= 0.05  then 'Positive'
  when mood_score >= -0.05 then 'Neutral'
  when mood_score >= -0.7  then 'Negative'
  else                          'Extremely Negative'
end
where mood_score is not null
  and mood_level is distinct from (
    case
      when mood_score >= 0.7   then 'Extremely Positive'
      when mood_score >= 0.05  then 'Positive'
      when mood_score >= -0.05 then 'Neutral'
      when mood_score >= -0.7  then 'Negative'
      else                          'Extremely Negative'
    end
  );
