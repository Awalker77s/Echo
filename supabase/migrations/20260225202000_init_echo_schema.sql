-- Echo Journal Phase 1 schema
create extension if not exists "pgcrypto";

create type public.user_plan as enum ('free', 'core', 'memoir', 'lifetime');

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  plan public.user_plan not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  recording_count integer not null default 0,
  timezone text default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  audio_url text not null,
  raw_transcript text,
  cleaned_entry text,
  entry_title text,
  duration_seconds integer,
  mood_primary text,
  mood_score float,
  mood_tags text[] default '{}',
  themes text[] default '{}',
  people_mentioned text[] default '{}',
  word_count integer,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  content text not null,
  category text not null,
  is_starred boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.mood_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  mood_primary text,
  mood_score float,
  mood_tags text[] default '{}',
  recorded_at timestamptz not null default now()
);

create table if not exists public.patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  pattern_type text not null,
  description text not null,
  evidence jsonb not null default '[]'::jsonb,
  confidence float,
  surfaced_at timestamptz not null default now(),
  dismissed boolean not null default false
);

create table if not exists public.chapter_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  month date not null,
  title text,
  narrative text,
  top_themes text[] default '{}',
  mood_summary jsonb default '{}'::jsonb,
  growth_moments jsonb default '[]'::jsonb,
  entry_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, month)
);

alter table public.users enable row level security;
alter table public.journal_entries enable row level security;
alter table public.ideas enable row level security;
alter table public.mood_history enable row level security;
alter table public.patterns enable row level security;
alter table public.chapter_reports enable row level security;

create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_update_own" on public.users for update using (auth.uid() = id);
create policy "users_insert_own" on public.users for insert with check (auth.uid() = id);

create policy "journal_entries_all_own" on public.journal_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ideas_all_own" on public.ideas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mood_history_all_own" on public.mood_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "patterns_all_own" on public.patterns for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "chapter_reports_all_own" on public.chapter_reports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('journal-audio', 'journal-audio', false)
on conflict (id) do nothing;

create policy "audio_bucket_access_own" on storage.objects
for all
using (
  bucket_id = 'journal-audio'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'journal-audio'
  and auth.uid()::text = (storage.foldername(name))[1]
);
