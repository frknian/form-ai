alter table public.sport_activity_entries add column if not exists estimated_calories integer check (estimated_calories is null or estimated_calories >= 0);
alter table public.sport_activity_entries add column if not exists steps integer check (steps is null or steps >= 0);
alter table public.sport_activity_entries add column if not exists source text not null default 'manual' check (source in ('manual', 'gps', 'strava', 'wearable'));
alter table public.sport_activity_entries add column if not exists provider text;
alter table public.sport_activity_entries add column if not exists external_activity_id text;
alter table public.sport_activity_entries add column if not exists route_reference text;
alter table public.sport_activity_entries add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.sport_activity_entries add column if not exists schema_version integer not null default 1 check (schema_version >= 1);

create unique index if not exists sport_activity_entries_external_idx
  on public.sport_activity_entries (user_id, provider, external_activity_id)
  where provider is not null and external_activity_id is not null;
