create table if not exists public.sport_activity_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('walk', 'sport')),
  sport_key text not null check (char_length(sport_key) between 2 and 40),
  sport_name text not null check (char_length(sport_name) between 2 and 80),
  occurred_at timestamptz not null default now(),
  local_date date not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  intensity text not null check (intensity in ('hafif', 'orta', 'yuksek')),
  distance_km numeric(8,2) check (distance_km is null or distance_km >= 0),
  estimated_calories integer check (estimated_calories is null or estimated_calories >= 0),
  steps integer check (steps is null or steps >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  details jsonb not null default '{}'::jsonb,
  source text not null default 'manual' check (source in ('manual', 'gps', 'strava', 'wearable')),
  provider text,
  external_activity_id text,
  route_reference text,
  metadata jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1 check (schema_version >= 1),
  created_at timestamptz not null default now()
);

alter table public.sport_activity_entries add column if not exists estimated_calories integer check (estimated_calories is null or estimated_calories >= 0);
alter table public.sport_activity_entries add column if not exists steps integer check (steps is null or steps >= 0);
alter table public.sport_activity_entries add column if not exists source text not null default 'manual' check (source in ('manual', 'gps', 'strava', 'wearable'));
alter table public.sport_activity_entries add column if not exists provider text;
alter table public.sport_activity_entries add column if not exists external_activity_id text;
alter table public.sport_activity_entries add column if not exists route_reference text;
alter table public.sport_activity_entries add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.sport_activity_entries add column if not exists schema_version integer not null default 1 check (schema_version >= 1);

create index if not exists sport_activity_entries_user_date_idx
  on public.sport_activity_entries (user_id, local_date desc, occurred_at desc);
create unique index if not exists sport_activity_entries_external_idx
  on public.sport_activity_entries (user_id, provider, external_activity_id)
  where provider is not null and external_activity_id is not null;

alter table public.sport_activity_entries enable row level security;
drop policy if exists "Users can read own sport activities" on public.sport_activity_entries;
drop policy if exists "Users can insert own sport activities" on public.sport_activity_entries;
drop policy if exists "Users can update own sport activities" on public.sport_activity_entries;
drop policy if exists "Users can delete own sport activities" on public.sport_activity_entries;
create policy "Users can read own sport activities" on public.sport_activity_entries for select using (auth.uid() = user_id);
create policy "Users can insert own sport activities" on public.sport_activity_entries for insert with check (auth.uid() = user_id);
create policy "Users can update own sport activities" on public.sport_activity_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own sport activities" on public.sport_activity_entries for delete using (auth.uid() = user_id);
