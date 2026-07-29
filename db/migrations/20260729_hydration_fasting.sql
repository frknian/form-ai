-- Su tüketimi ve aralıklı oruç takibi.
--
-- Su, gün başına TEK satırda toplam olarak tutulur (kullanıcı+tarih birincil
-- anahtar); her yudumu ayrı satıra yazmak sorgu ve temizlik maliyetini
-- gereksiz büyütürdü, ekranda gösterilen zaten günlük toplam.
--
-- Oruç, açık uçlu bir pencere olarak tutulur: ended_at NULL ise oruç sürüyor
-- demektir. Süre veritabanında hesaplanmaz, istemcide (lib/hydration-fasting.ts)
-- hesaplanır; böylece sayaç her saniye tazelenirken sunucuya gidilmez.

create table if not exists public.water_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  milliliters integer not null default 0 check (milliliters between 0 and 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

alter table public.water_logs enable row level security;
drop policy if exists "Users manage own water logs" on public.water_logs;
create policy "Users manage own water logs" on public.water_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.fasting_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  target_hours smallint not null default 16 check (target_hours between 8 and 36),
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

-- Aynı anda yalnız bir oruç açık olabilir; iki kez "başlat"a basmak ikinci bir
-- açık pencere yaratıp sayacı belirsizleştirirdi.
create unique index if not exists fasting_sessions_one_open_per_user
  on public.fasting_sessions (user_id) where ended_at is null;

create index if not exists fasting_sessions_user_started_idx
  on public.fasting_sessions (user_id, started_at desc);

alter table public.fasting_sessions enable row level security;
drop policy if exists "Users manage own fasting sessions" on public.fasting_sessions;
create policy "Users manage own fasting sessions" on public.fasting_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
