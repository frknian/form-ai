create table if not exists public.user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 1 check (current_streak >= 1),
  last_activity_date date not null,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('workout', 'walk', 'sport')),
  occurred_at timestamptz not null default now(),
  local_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, activity_type, local_date)
);

create index if not exists activity_logs_user_local_date_idx on public.activity_logs (user_id, local_date desc);
alter table public.user_streaks enable row level security;
alter table public.activity_logs enable row level security;
drop policy if exists "Users can read own streak" on public.user_streaks;
drop policy if exists "Users can read own activities" on public.activity_logs;
create policy "Users can read own streak" on public.user_streaks for select using (auth.uid() = user_id);
create policy "Users can read own activities" on public.activity_logs for select using (auth.uid() = user_id);

create or replace function public.ensure_user_streak(p_timezone text default 'UTC')
returns public.user_streaks language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_zone text := coalesce(nullif(p_timezone, ''), 'UTC'); v_today date; v_row public.user_streaks;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from pg_timezone_names where name = v_zone) then v_zone := 'UTC'; end if;
  v_today := (now() at time zone v_zone)::date;
  insert into public.user_streaks (user_id, current_streak, last_activity_date, timezone) values (v_user, 1, v_today, v_zone)
  on conflict (user_id) do update set timezone = excluded.timezone, updated_at = now()
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.record_streak_activity(p_activity_type text, p_timezone text default 'UTC')
returns public.user_streaks language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_zone text := coalesce(nullif(p_timezone, ''), 'UTC'); v_today date; v_row public.user_streaks; v_had_activity boolean; v_gap date; v_break boolean := false; v_new boolean := false;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_activity_type not in ('workout', 'walk', 'sport') then raise exception 'Invalid activity type'; end if;
  if not exists (select 1 from pg_timezone_names where name = v_zone) then v_zone := 'UTC'; end if;
  v_today := (now() at time zone v_zone)::date;
  select not exists(select 1 from public.user_streaks where user_id = v_user) into v_new;
  perform public.ensure_user_streak(v_zone);
  select * into v_row from public.user_streaks where user_id = v_user for update;
  select exists(select 1 from public.activity_logs where user_id = v_user and local_date = v_today) into v_had_activity;
  insert into public.activity_logs (user_id, activity_type, occurred_at, local_date) values (v_user, p_activity_type, now(), v_today) on conflict (user_id, activity_type, local_date) do nothing;
  if not v_had_activity and not v_new then
    for v_gap in select generate_series(v_row.last_activity_date + 1, v_today - 1, interval '1 day')::date loop
      if not exists (select 1 from public.workout_schedule where user_id = v_user and scheduled_date = v_gap and status = 'rest') then v_break := true; exit; end if;
    end loop;
    update public.user_streaks set current_streak = case when v_break then 1 else current_streak + 1 end, last_activity_date = v_today, timezone = v_zone, updated_at = now() where user_id = v_user returning * into v_row;
  end if;
  return v_row;
end $$;

grant execute on function public.ensure_user_streak(text) to authenticated;
grant execute on function public.record_streak_activity(text, text) to authenticated;

create or replace function public.record_workout_streak_activity() returns trigger language plpgsql security definer set search_path = public as $$
declare v_zone text; v_today date; v_row public.user_streaks; v_had_activity boolean; v_gap date; v_break boolean := false; v_new boolean := false;
begin
  select timezone into v_zone from public.user_streaks where user_id = new.user_id;
  if v_zone is null then v_zone := 'UTC'; end if;
  v_today := (new.completed_at at time zone v_zone)::date;
  if not exists (select 1 from public.user_streaks where user_id = new.user_id) then
    insert into public.user_streaks (user_id, current_streak, last_activity_date, timezone) values (new.user_id, 1, v_today, v_zone);
    v_new := true;
  end if;
  select * into v_row from public.user_streaks where user_id = new.user_id for update;
  select exists(select 1 from public.activity_logs where user_id = new.user_id and local_date = v_today) into v_had_activity;
  insert into public.activity_logs (user_id, activity_type, occurred_at, local_date) values (new.user_id, 'workout', new.completed_at, v_today) on conflict (user_id, activity_type, local_date) do nothing;
  if not v_had_activity and not v_new then
    for v_gap in select generate_series(v_row.last_activity_date + 1, v_today - 1, interval '1 day')::date loop
      if not exists (select 1 from public.workout_schedule where user_id = new.user_id and scheduled_date = v_gap and status = 'rest') then v_break := true; exit; end if;
    end loop;
    update public.user_streaks set current_streak = case when v_break then 1 else current_streak + 1 end, last_activity_date = v_today, updated_at = now() where user_id = new.user_id;
  end if;
  return new;
end $$;

drop trigger if exists workout_sessions_record_streak on public.workout_sessions;
create trigger workout_sessions_record_streak after insert on public.workout_sessions for each row execute function public.record_workout_streak_activity();
