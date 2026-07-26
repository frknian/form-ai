-- Günlük kullanım sınırları: ücretsiz sürümde sohbet ve fotoğrafla besin
-- ekleme AI çağrıları sınırlıdır (ücretsiz: 5/5, ücretli: 15/10 — sınırların
-- kendisi kodda, bkz. lib/usage-limits.ts). Ücretli durum şimdilik uygulamada
-- ödeme/IAP entegrasyonu olmadığı için profiles.is_premium alanından elle
-- (ör. Supabase panelinden) yönetilir; IAP eklendiğinde bu alan otomatik
-- güncellenecek şekilde genişletilebilir.
--
-- Sayaç artırma, yarış durumunu (race condition) önlemek için doğrudan tablo
-- UPDATE'i yerine SECURITY DEFINER bir fonksiyon (increment_usage_counter)
-- üzerinden, satır kilidiyle (FOR UPDATE) atomik biçimde yapılır. Bu yüzden
-- usage_counters tablosunda istemciye INSERT/UPDATE izni verilmez — yalnızca
-- kendi satırlarını okuyabilir; sayacı sıfırlama/manipülasyon riski kalmaz.

alter table public.profiles add column if not exists is_premium boolean not null default false;

create table if not exists public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('chat', 'photo')),
  usage_date date not null default (current_date),
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, feature, usage_date)
);

alter table public.usage_counters enable row level security;
drop policy if exists "Users can read own usage" on public.usage_counters;
create policy "Users can read own usage" on public.usage_counters for select using (auth.uid() = user_id);

create or replace function public.increment_usage_counter(p_feature text, p_limit integer)
returns table (allowed boolean, current_count integer)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_feature not in ('chat', 'photo') then
    raise exception 'invalid feature';
  end if;

  insert into public.usage_counters (user_id, feature, usage_date, count)
  values (v_user, p_feature, current_date, 0)
  on conflict (user_id, feature, usage_date) do nothing;

  select count into v_count from public.usage_counters
  where user_id = v_user and feature = p_feature and usage_date = current_date
  for update;

  if v_count >= p_limit then
    return query select false, v_count;
  else
    update public.usage_counters set count = count + 1, updated_at = now()
    where user_id = v_user and feature = p_feature and usage_date = current_date;
    return query select true, v_count + 1;
  end if;
end;
$$;

grant execute on function public.increment_usage_counter(text, integer) to authenticated;
