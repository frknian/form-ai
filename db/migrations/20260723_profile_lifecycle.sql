alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists requested_exercises text not null default '';
alter table public.profiles add column if not exists account_status text not null default 'active' check (account_status in ('active', 'frozen', 'deletion_pending'));
alter table public.profiles add column if not exists frozen_at timestamptz;
alter table public.profiles add column if not exists deletion_requested_at timestamptz;

create table if not exists public.profile_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  changed_at timestamptz not null default now(),
  changed_fields text[] not null default '{}'::text[],
  snapshot jsonb not null,
  source text not null default 'user' check (source in ('user', 'onboarding', 'system'))
);

create index if not exists profile_history_user_changed_idx on public.profile_history (user_id, changed_at desc);
alter table public.profile_history enable row level security;
drop policy if exists "Users can read own profile history" on public.profile_history;
drop policy if exists "Users can insert own profile history" on public.profile_history;
create policy "Users can read own profile history" on public.profile_history for select using (auth.uid() = user_id);
create policy "Users can insert own profile history" on public.profile_history for insert with check (auth.uid() = user_id);

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.feature_flags (key, enabled, config)
values ('birthday_premium_day', false, '{"duration_hours":24}'::jsonb)
on conflict (key) do nothing;

alter table public.feature_flags enable row level security;
drop policy if exists "Authenticated users can read feature flags" on public.feature_flags;
create policy "Authenticated users can read feature flags" on public.feature_flags for select to authenticated using (true);

create or replace function public.account_is_active(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select check_user_id is not null and coalesce((select account_status = 'active' from public.profiles where id = check_user_id), true);
$$;
revoke all on function public.account_is_active(uuid) from public;
grant execute on function public.account_is_active(uuid) to authenticated;

alter policy "Users can read own workout sessions" on public.workout_sessions using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can insert own workout sessions" on public.workout_sessions with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can delete own workout sessions" on public.workout_sessions using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can read own workout plans" on public.workout_plans using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can insert own workout plans" on public.workout_plans with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can update own workout plans" on public.workout_plans using (auth.uid() = user_id and public.account_is_active()) with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can delete own workout plans" on public.workout_plans using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can read own workout exercise logs" on public.workout_exercise_logs using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can insert own workout exercise logs" on public.workout_exercise_logs with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can update own workout exercise logs" on public.workout_exercise_logs using (auth.uid() = user_id and public.account_is_active()) with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can delete own workout exercise logs" on public.workout_exercise_logs using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can read own workout set logs" on public.workout_set_logs using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can insert own workout set logs" on public.workout_set_logs with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can update own workout set logs" on public.workout_set_logs using (auth.uid() = user_id and public.account_is_active()) with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can delete own workout set logs" on public.workout_set_logs using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can read own workout schedule" on public.workout_schedule using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can insert own workout schedule" on public.workout_schedule with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can update own workout schedule" on public.workout_schedule using (auth.uid() = user_id and public.account_is_active()) with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can delete own workout schedule" on public.workout_schedule using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can read own reminder preferences" on public.reminder_preferences using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can insert own reminder preferences" on public.reminder_preferences with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can update own reminder preferences" on public.reminder_preferences using (auth.uid() = user_id and public.account_is_active()) with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can delete own reminder preferences" on public.reminder_preferences using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can read own body measurements" on public.body_measurements using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can insert own body measurements" on public.body_measurements with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can update own body measurements" on public.body_measurements using (auth.uid() = user_id and public.account_is_active()) with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can delete own body measurements" on public.body_measurements using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can read own weekly AI reviews" on public.weekly_ai_reviews using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can insert own weekly AI reviews" on public.weekly_ai_reviews with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can update own weekly AI reviews" on public.weekly_ai_reviews using (auth.uid() = user_id and public.account_is_active()) with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can delete own weekly AI reviews" on public.weekly_ai_reviews using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can read own nutrition goals" on public.nutrition_goals using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can insert own nutrition goals" on public.nutrition_goals with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can update own nutrition goals" on public.nutrition_goals using (auth.uid() = user_id and public.account_is_active()) with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can delete own nutrition goals" on public.nutrition_goals using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can read own food entries" on public.food_entries using (auth.uid() = user_id and public.account_is_active());
alter policy "Users can insert own food entries" on public.food_entries with check (auth.uid() = user_id and public.account_is_active());
alter policy "Users can delete own food entries" on public.food_entries using (auth.uid() = user_id and public.account_is_active());
-- Seri ve aktivite tabloları ayrı migration'larla yönetilir. Profil yaşam
-- döngüsü bu isteğe bağlı tablolara bağlı değildir.

create or replace function public.update_profile_with_history(p_profile jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  previous public.profiles%rowtype;
  updated public.profiles%rowtype;
  changed text[] := '{}'::text[];
begin
  if uid is null then raise exception 'authentication required'; end if;
  select * into previous from public.profiles where id = uid;

  insert into public.profiles (
    id, display_name, birth_date, age, gender, height_cm, weight_kg,
    environment, equipment_text, goal_text, requested_exercises, avatar_path, updated_at
  ) values (
    uid,
    nullif(trim(p_profile->>'display_name'), ''),
    nullif(p_profile->>'birth_date', '')::date,
    null,
    nullif(p_profile->>'gender', ''),
    nullif(p_profile->>'height_cm', '')::numeric,
    nullif(p_profile->>'weight_kg', '')::numeric,
    case when p_profile->>'environment' = 'Salon' then 'Salon' else 'Evde' end,
    coalesce(p_profile->>'equipment_text', ''),
    coalesce(p_profile->>'goal_text', ''),
    coalesce(p_profile->>'requested_exercises', ''),
    nullif(p_profile->>'avatar_path', ''),
    now()
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    birth_date = excluded.birth_date,
    age = null,
    gender = excluded.gender,
    height_cm = excluded.height_cm,
    weight_kg = excluded.weight_kg,
    environment = excluded.environment,
    equipment_text = excluded.equipment_text,
    goal_text = excluded.goal_text,
    requested_exercises = excluded.requested_exercises,
    avatar_path = excluded.avatar_path,
    updated_at = now()
  returning * into updated;

  if previous.id is null or previous.display_name is distinct from updated.display_name then changed := array_append(changed, 'display_name'); end if;
  if previous.id is null or previous.birth_date is distinct from updated.birth_date then changed := array_append(changed, 'birth_date'); end if;
  if previous.id is null or previous.gender is distinct from updated.gender then changed := array_append(changed, 'gender'); end if;
  if previous.id is null or previous.height_cm is distinct from updated.height_cm then changed := array_append(changed, 'height_cm'); end if;
  if previous.id is null or previous.weight_kg is distinct from updated.weight_kg then changed := array_append(changed, 'weight_kg'); end if;
  if previous.id is null or previous.goal_text is distinct from updated.goal_text then changed := array_append(changed, 'goal_text'); end if;
  if previous.id is null or previous.environment is distinct from updated.environment then changed := array_append(changed, 'environment'); end if;
  if previous.id is null or previous.equipment_text is distinct from updated.equipment_text then changed := array_append(changed, 'equipment_text'); end if;
  if previous.id is null or previous.requested_exercises is distinct from updated.requested_exercises then changed := array_append(changed, 'requested_exercises'); end if;
  if previous.id is null or previous.avatar_path is distinct from updated.avatar_path then changed := array_append(changed, 'avatar_path'); end if;

  if cardinality(changed) > 0 then
    insert into public.profile_history (user_id, changed_fields, snapshot, source)
    values (uid, changed, jsonb_build_object(
      'display_name', updated.display_name,
      'birth_date', updated.birth_date,
      'gender', updated.gender,
      'height_cm', updated.height_cm,
      'weight_kg', updated.weight_kg,
      'goal_text', updated.goal_text,
      'environment', updated.environment,
      'equipment_text', updated.equipment_text,
      'requested_exercises', updated.requested_exercises,
      'avatar_path', updated.avatar_path
    ), case when previous.id is null then 'onboarding' else 'user' end);
  end if;
end;
$$;

revoke all on function public.update_profile_with_history(jsonb) from public;
grant execute on function public.update_profile_with_history(jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own profile avatars" on storage.objects;
drop policy if exists "Users can upload own profile avatars" on storage.objects;
drop policy if exists "Users can update own profile avatars" on storage.objects;
drop policy if exists "Users can delete own profile avatars" on storage.objects;
create policy "Users can read own profile avatars" on storage.objects for select to authenticated using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.account_is_active());
create policy "Users can upload own profile avatars" on storage.objects for insert to authenticated with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.account_is_active());
create policy "Users can update own profile avatars" on storage.objects for update to authenticated using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.account_is_active()) with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.account_is_active());
create policy "Users can delete own profile avatars" on storage.objects for delete to authenticated using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.account_is_active());
