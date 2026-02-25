-- Echo Journal Phase 3 additions

create table if not exists public.gift_codes (
  id uuid primary key default gen_random_uuid(),
  purchaser_user_id uuid not null references public.users(id) on delete cascade,
  redeemed_by_user_id uuid references public.users(id) on delete set null,
  plan public.user_plan not null,
  code text not null unique,
  stripe_checkout_session_id text,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.memoir_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  order_id text not null unique,
  chapter_ids uuid[] not null default '{}',
  provider text not null,
  status text not null default 'submitted',
  provider_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.gift_codes enable row level security;
alter table public.memoir_orders enable row level security;

create policy "gift_codes_select_owner_or_recipient" on public.gift_codes
  for select using (auth.uid() = purchaser_user_id or auth.uid() = redeemed_by_user_id);

create policy "gift_codes_insert_purchaser" on public.gift_codes
  for insert with check (auth.uid() = purchaser_user_id);

create policy "gift_codes_update_owner_or_recipient" on public.gift_codes
  for update using (auth.uid() = purchaser_user_id or auth.uid() = redeemed_by_user_id)
  with check (auth.uid() = purchaser_user_id or auth.uid() = redeemed_by_user_id);

create policy "memoir_orders_all_own" on public.memoir_orders
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
