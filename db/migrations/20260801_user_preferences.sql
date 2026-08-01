-- Cihazlar arası tercih eşitlemesi.
--
-- Tema, dil, ağırlık birimi, hedef kilo ve ana ekran kısayolları bugüne kadar
-- yalnız localStorage'daydı; telefonda yapılan seçim web'de görünmüyordu.
--
-- Her tercih için ayrı sütun açmak yerine tek bir jsonb tutulur: yeni bir
-- tercih eklendiğinde migration gerekmesin diye. Değerler istemcinin
-- localStorage'a yazdığı ham dizelerdir (lib/preference-sync.ts), böylece
-- eşitleme katmanı her tercihin biçimini ayrıca bilmek zorunda kalmaz.
--
-- Satır kullanıcı başına tektir; çakışma çözümü istemcide yapılır
-- (uzaktaki değer kazanır, yalnız yerelde olan anahtarlar yukarı itilir).

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
drop policy if exists "Users manage own preferences" on public.user_preferences;
create policy "Users manage own preferences" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
