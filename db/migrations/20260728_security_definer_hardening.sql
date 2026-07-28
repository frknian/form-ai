-- SECURITY DEFINER hardening.
--
-- Premium entitlement is moved out of public.profiles so authenticated clients
-- cannot grant themselves a higher usage limit. Existing true values are copied
-- once for compatibility; they should be audited against the billing provider.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_premium boolean not null default false,
  updated_at timestamptz not null default now()
);

revoke all on private.user_entitlements from public, anon, authenticated;
grant select, insert, update, delete on private.user_entitlements to service_role;

insert into private.user_entitlements (user_id, is_premium)
select p.id, p.is_premium
from public.profiles p
where p.is_premium
on conflict (user_id) do nothing;

comment on column public.profiles.is_premium is
  'Deprecated display field. Usage authorization is sourced from private.user_entitlements.';

-- Do not allow a user-scoped request to alter even the deprecated public flag.
create or replace function public.protect_managed_profile_fields()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (
       (tg_op = 'INSERT' and new.is_premium)
       or (tg_op = 'UPDATE' and new.is_premium is distinct from old.is_premium)
     ) then
    raise exception 'is_premium is managed by the subscription service'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_managed_profile_fields()
  from public, anon, authenticated;

drop trigger if exists profiles_protect_managed_fields on public.profiles;
create trigger profiles_protect_managed_fields
before insert or update on public.profiles
for each row execute function public.protect_managed_profile_fields();

-- The parameter is retained temporarily because 42 existing policies call this
-- signature. It cannot be used to inspect another user's account.
create or replace function public.account_is_active(
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select auth.uid() is not null
    and check_user_id = auth.uid()
    and coalesce((
      select p.account_status = 'active'
      from public.profiles p
      where p.id = auth.uid()
    ), false);
$$;

revoke all on function public.account_is_active(uuid) from public, anon;
grant execute on function public.account_is_active(uuid) to authenticated;

-- This is the authoritative usage RPC. The caller supplies only the feature;
-- both entitlement and the effective limit are resolved inside the database.
create or replace function public.increment_usage_counter(p_feature text)
returns table (
  allowed boolean,
  current_count integer,
  effective_limit integer
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
  v_is_premium boolean;
  v_limit integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_feature not in ('chat', 'photo') then
    raise exception 'invalid feature' using errcode = '22023';
  end if;

  select coalesce(e.is_premium, false)
  into v_is_premium
  from private.user_entitlements e
  where e.user_id = v_user;
  v_is_premium := coalesce(v_is_premium, false);

  v_limit := case
    when p_feature = 'chat' and v_is_premium then 15
    when p_feature = 'photo' and v_is_premium then 10
    else 5
  end;

  insert into public.usage_counters (user_id, feature, usage_date, count)
  values (v_user, p_feature, current_date, 0)
  on conflict (user_id, feature, usage_date) do nothing;

  select uc.count
  into v_count
  from public.usage_counters uc
  where uc.user_id = v_user
    and uc.feature = p_feature
    and uc.usage_date = current_date
  for update;

  if v_count >= v_limit then
    return query select false, v_count, v_limit;
  else
    update public.usage_counters uc
    set count = uc.count + 1,
        updated_at = now()
    where uc.user_id = v_user
      and uc.feature = p_feature
      and uc.usage_date = current_date;
    return query select true, v_count + 1, v_limit;
  end if;
end;
$$;

revoke all on function public.increment_usage_counter(text)
  from public, anon;
grant execute on function public.increment_usage_counter(text)
  to authenticated;

-- Compatibility wrapper for an older app deployment. p_limit is intentionally
-- ignored, so a direct RPC caller can no longer choose the authorization limit.
create or replace function public.increment_usage_counter(
  p_feature text,
  p_limit integer
)
returns table (allowed boolean, current_count integer)
language sql
security invoker
set search_path = pg_catalog
as $$
  select result.allowed, result.current_count
  from public.increment_usage_counter(p_feature) result;
$$;

revoke all on function public.increment_usage_counter(text, integer)
  from public, anon;
grant execute on function public.increment_usage_counter(text, integer)
  to authenticated;

-- Streak writes deliberately bypass table RLS, but identity always comes from
-- auth.uid(). All referenced application relations remain schema-qualified.
create or replace function public.ensure_user_streak(
  p_timezone text default 'UTC'
)
returns public.user_streaks
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_zone text := coalesce(nullif(p_timezone, ''), 'UTC');
  v_today date;
  v_row public.user_streaks;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_zone
  ) then
    v_zone := 'UTC';
  end if;
  v_today := (now() at time zone v_zone)::date;

  insert into public.user_streaks (
    user_id, current_streak, last_activity_date, timezone
  )
  values (v_user, 1, v_today, v_zone)
  on conflict (user_id) do update
    set timezone = excluded.timezone,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.ensure_user_streak(text) from public, anon;
grant execute on function public.ensure_user_streak(text) to authenticated;

create or replace function public.record_streak_activity(
  p_activity_type text,
  p_timezone text default 'UTC'
)
returns public.user_streaks
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_zone text := coalesce(nullif(p_timezone, ''), 'UTC');
  v_today date;
  v_row public.user_streaks;
  v_had_activity boolean;
  v_gap date;
  v_break boolean := false;
  v_new boolean := false;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_activity_type not in ('workout', 'walk', 'sport') then
    raise exception 'Invalid activity type' using errcode = '22023';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = v_zone
  ) then
    v_zone := 'UTC';
  end if;
  v_today := (now() at time zone v_zone)::date;

  select not exists (
    select 1 from public.user_streaks where user_id = v_user
  ) into v_new;
  perform public.ensure_user_streak(v_zone);

  select *
  into v_row
  from public.user_streaks
  where user_id = v_user
  for update;

  select exists (
    select 1
    from public.activity_logs
    where user_id = v_user and local_date = v_today
  ) into v_had_activity;

  insert into public.activity_logs (
    user_id, activity_type, occurred_at, local_date
  )
  values (v_user, p_activity_type, now(), v_today)
  on conflict (user_id, activity_type, local_date) do nothing;

  if not v_had_activity and not v_new then
    for v_gap in
      select generate_series(
        v_row.last_activity_date + 1,
        v_today - 1,
        interval '1 day'
      )::date
    loop
      if not exists (
        select 1
        from public.workout_schedule
        where user_id = v_user
          and scheduled_date = v_gap
          and status = 'rest'
      ) then
        v_break := true;
        exit;
      end if;
    end loop;

    update public.user_streaks
    set current_streak = case
          when v_break then 1
          else current_streak + 1
        end,
        last_activity_date = v_today,
        timezone = v_zone,
        updated_at = now()
    where user_id = v_user
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.record_streak_activity(text, text)
  from public, anon;
grant execute on function public.record_streak_activity(text, text)
  to authenticated;

create or replace function public.record_workout_streak_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_zone text;
  v_today date;
  v_row public.user_streaks;
  v_had_activity boolean;
  v_gap date;
  v_break boolean := false;
  v_new boolean := false;
begin
  if auth.uid() is not null and new.user_id is distinct from auth.uid() then
    raise exception 'workout user does not match authenticated user'
      using errcode = '42501';
  end if;

  select timezone
  into v_zone
  from public.user_streaks
  where user_id = new.user_id;
  if v_zone is null then
    v_zone := 'UTC';
  end if;
  v_today := (new.completed_at at time zone v_zone)::date;

  if not exists (
    select 1 from public.user_streaks where user_id = new.user_id
  ) then
    insert into public.user_streaks (
      user_id, current_streak, last_activity_date, timezone
    )
    values (new.user_id, 1, v_today, v_zone);
    v_new := true;
  end if;

  select *
  into v_row
  from public.user_streaks
  where user_id = new.user_id
  for update;

  select exists (
    select 1
    from public.activity_logs
    where user_id = new.user_id and local_date = v_today
  ) into v_had_activity;

  insert into public.activity_logs (
    user_id, activity_type, occurred_at, local_date
  )
  values (new.user_id, 'workout', new.completed_at, v_today)
  on conflict (user_id, activity_type, local_date) do nothing;

  if not v_had_activity and not v_new then
    for v_gap in
      select generate_series(
        v_row.last_activity_date + 1,
        v_today - 1,
        interval '1 day'
      )::date
    loop
      if not exists (
        select 1
        from public.workout_schedule
        where user_id = new.user_id
          and scheduled_date = v_gap
          and status = 'rest'
      ) then
        v_break := true;
        exit;
      end if;
    end loop;

    update public.user_streaks
    set current_streak = case
          when v_break then 1
          else current_streak + 1
        end,
        last_activity_date = v_today,
        updated_at = now()
    where user_id = new.user_id;
  end if;

  return new;
end;
$$;

revoke all on function public.record_workout_streak_activity()
  from public, anon, authenticated;
