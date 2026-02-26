-- Ensure the ideas table exists with all required columns (idea_type, details)
-- This guards against environments where prior migrations were not fully applied.

CREATE TABLE IF NOT EXISTS public.ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  content text NOT NULL,
  category text NOT NULL,
  idea_type text,
  details text,
  is_starred boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add columns that may be missing if the table was created by an earlier migration
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS idea_type text;
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS details text;
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;

ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

-- Re-create the policy idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ideas'
      AND policyname = 'ideas_all_own'
  ) THEN
    CREATE POLICY "ideas_all_own" ON public.ideas
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;
