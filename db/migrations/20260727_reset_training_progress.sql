alter table public.user_streaks
  drop constraint if exists user_streaks_current_streak_check;
alter table public.user_streaks
  alter column current_streak set default 0,
  alter column last_activity_date drop not null;
alter table public.user_streaks
  add constraint user_streaks_current_streak_check check (current_streak >= 0);

create or replace function public.ensure_user_streak(p_timezone text default 'UTC')
returns public.user_streaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_zone text := coalesce(nullif(p_timezone, ''), 'UTC');
  v_row public.user_streaks;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from pg_timezone_names where name = v_zone) then v_zone := 'UTC'; end if;

  insert into public.user_streaks (user_id, current_streak, last_activity_date, timezone)
  values (v_user, 0, null, v_zone)
  on conflict (user_id) do update
  set timezone = excluded.timezone, updated_at = now()
  returning * into v_row;

  return v_row;
end
$$;

create or replace function public.record_streak_activity(p_activity_type text, p_timezone text default 'UTC')
returns public.user_streaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_zone text := coalesce(nullif(p_timezone, ''), 'UTC');
  v_today date;
  v_row public.user_streaks;
  v_had_activity boolean;
  v_gap date;
  v_break boolean := false;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_activity_type not in ('workout', 'walk', 'sport') then raise exception 'Invalid activity type'; end if;
  if not exists (select 1 from pg_timezone_names where name = v_zone) then v_zone := 'UTC'; end if;
  v_today := (now() at time zone v_zone)::date;

  perform public.ensure_user_streak(v_zone);
  select * into v_row from public.user_streaks where user_id = v_user for update;
  select exists(
    select 1 from public.activity_logs
    where user_id = v_user and local_date = v_today
  ) into v_had_activity;

  insert into public.activity_logs (user_id, activity_type, occurred_at, local_date)
  values (v_user, p_activity_type, now(), v_today)
  on conflict (user_id, activity_type, local_date) do nothing;

  if not v_had_activity then
    if v_row.last_activity_date is not null then
      for v_gap in
        select generate_series(v_row.last_activity_date + 1, v_today - 1, interval '1 day')::date
      loop
        if not exists (
          select 1 from public.workout_schedule
          where user_id = v_user and scheduled_date = v_gap and status = 'rest'
        ) then
          v_break := true;
          exit;
        end if;
      end loop;
    end if;

    update public.user_streaks
    set current_streak = case
          when last_activity_date is null or v_break then 1
          else current_streak + 1
        end,
        last_activity_date = v_today,
        timezone = v_zone,
        updated_at = now()
    where user_id = v_user
    returning * into v_row;
  end if;

  return v_row;
end
$$;

create or replace function public.record_workout_streak_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zone text;
  v_today date;
  v_row public.user_streaks;
  v_had_activity boolean;
  v_gap date;
  v_break boolean := false;
begin
  select timezone into v_zone from public.user_streaks where user_id = new.user_id;
  if v_zone is null then v_zone := 'UTC'; end if;
  v_today := (new.completed_at at time zone v_zone)::date;

  insert into public.user_streaks (user_id, current_streak, last_activity_date, timezone)
  values (new.user_id, 0, null, v_zone)
  on conflict (user_id) do nothing;

  select * into v_row from public.user_streaks where user_id = new.user_id for update;
  select exists(
    select 1 from public.activity_logs
    where user_id = new.user_id and local_date = v_today
  ) into v_had_activity;

  insert into public.activity_logs (user_id, activity_type, occurred_at, local_date)
  values (new.user_id, 'workout', new.completed_at, v_today)
  on conflict (user_id, activity_type, local_date) do nothing;

  if not v_had_activity then
    if v_row.last_activity_date is not null then
      for v_gap in
        select generate_series(v_row.last_activity_date + 1, v_today - 1, interval '1 day')::date
      loop
        if not exists (
          select 1 from public.workout_schedule
          where user_id = new.user_id and scheduled_date = v_gap and status = 'rest'
        ) then
          v_break := true;
          exit;
        end if;
      end loop;
    end if;

    update public.user_streaks
    set current_streak = case
          when last_activity_date is null or v_break then 1
          else current_streak + 1
        end,
        last_activity_date = v_today,
        updated_at = now()
    where user_id = new.user_id;
  end if;

  return new;
end
$$;

create or replace function public.reset_training_progress(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_workout_count integer := 0;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if p_confirmation <> 'RESET_TRAINING_PROGRESS' then
    raise exception 'Invalid reset confirmation';
  end if;

  select count(*)::integer
  into v_workout_count
  from public.workout_sessions
  where user_id = v_user;

  -- Reviews and completed calendar rows are derived from workout history.
  -- Calendar rows linked to completed sessions are removed by FK cascade.
  delete from public.weekly_ai_reviews where user_id = v_user;
  delete from public.activity_logs where user_id = v_user;
  update public.user_streaks
  set current_streak = 0,
      last_activity_date = null,
      updated_at = now()
  where user_id = v_user;
  delete from public.workout_sessions where user_id = v_user;

  return jsonb_build_object(
    'reset', true,
    'deleted_workouts', v_workout_count
  );
end
$$;

revoke all on function public.reset_training_progress(text) from public;
grant execute on function public.reset_training_progress(text) to authenticated;
