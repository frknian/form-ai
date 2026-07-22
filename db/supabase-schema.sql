create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  age smallint,
  birth_date date,
  gender text,
  height_cm numeric(5,2),
  weight_kg numeric(5,2),
  environment text,
  equipment_text text,
  requested_exercises text not null default '',
  goal_text text,
  history_answers jsonb not null default '[]'::jsonb,
  photo_url text,
  avatar_path text,
  account_status text not null default 'active' check (account_status in ('active', 'frozen', 'deletion_pending')),
  frozen_at timestamptz,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Profil yaşam döngüsü, tarihçe, özellik bayrakları ve özel avatar deposu için
-- db/migrations/20260723_profile_lifecycle.sql dosyası uygulanmalıdır.

create table if not exists public.workout_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  duration_seconds integer not null check (duration_seconds > 0),
  calories integer not null default 0 check (calories >= 0),
  completed_exercises smallint not null default 0 check (completed_exercises >= 0),
  total_exercises smallint not null check (total_exercises > 0),
  exercise_names jsonb not null default '[]'::jsonb,
  difficulty text check (difficulty in ('Kolay', 'Uygun', 'Zor')),
  fatigue smallint check (fatigue between 1 and 5),
  pain_areas jsonb not null default '[]'::jsonb,
  feedback_note text,
  created_at timestamptz not null default now()
);

alter table public.workout_sessions add column if not exists difficulty text check (difficulty in ('Kolay', 'Uygun', 'Zor'));
alter table public.workout_sessions add column if not exists fatigue smallint check (fatigue between 1 and 5);
alter table public.workout_sessions add column if not exists pain_areas jsonb not null default '[]'::jsonb;
alter table public.workout_sessions add column if not exists feedback_note text;

create index if not exists workout_sessions_user_completed_idx
  on public.workout_sessions (user_id, completed_at desc);

alter table public.workout_sessions enable row level security;
create policy "Users can read own workout sessions" on public.workout_sessions for select using (auth.uid() = user_id);
create policy "Users can insert own workout sessions" on public.workout_sessions for insert with check (auth.uid() = user_id);
create policy "Users can delete own workout sessions" on public.workout_sessions for delete using (auth.uid() = user_id);

create table if not exists public.workout_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workouts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workout_plans enable row level security;
create policy "Users can read own workout plans" on public.workout_plans for select using (auth.uid() = user_id);
create policy "Users can insert own workout plans" on public.workout_plans for insert with check (auth.uid() = user_id);
create policy "Users can update own workout plans" on public.workout_plans for update using (auth.uid() = user_id);
create policy "Users can delete own workout plans" on public.workout_plans for delete using (auth.uid() = user_id);

create unique index if not exists workout_sessions_id_user_idx
  on public.workout_sessions (id, user_id);

create table if not exists public.workout_exercise_logs (
  id uuid primary key,
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text,
  exercise_name text not null,
  exercise_key text not null,
  exercise_order smallint not null check (exercise_order > 0),
  is_bodyweight boolean not null default false,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (session_id, exercise_order),
  foreign key (session_id, user_id) references public.workout_sessions(id, user_id) on delete cascade
);

create unique index if not exists workout_exercise_logs_id_session_user_idx
  on public.workout_exercise_logs (id, session_id, user_id);
create index if not exists workout_exercise_logs_user_exercise_idx
  on public.workout_exercise_logs (user_id, exercise_key, completed_at desc);

alter table public.workout_exercise_logs enable row level security;
create policy "Users can read own workout exercise logs" on public.workout_exercise_logs for select using (auth.uid() = user_id);
create policy "Users can insert own workout exercise logs" on public.workout_exercise_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own workout exercise logs" on public.workout_exercise_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own workout exercise logs" on public.workout_exercise_logs for delete using (auth.uid() = user_id);

create table if not exists public.workout_set_logs (
  id uuid primary key,
  session_id uuid not null,
  exercise_log_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_number smallint not null check (set_number > 0),
  weight_kg numeric(7,2) check (weight_kg >= 0),
  reps smallint check (reps > 0),
  duration_seconds integer check (duration_seconds > 0),
  rpe smallint check (rpe between 1 and 10),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (exercise_log_id, set_number),
  check (weight_kg is not null or reps is not null or duration_seconds is not null or rpe is not null or nullif(trim(note), '') is not null),
  foreign key (exercise_log_id, session_id, user_id) references public.workout_exercise_logs(id, session_id, user_id) on delete cascade
);

create index if not exists workout_set_logs_user_exercise_idx
  on public.workout_set_logs (user_id, exercise_log_id, set_number);

alter table public.workout_set_logs enable row level security;
create policy "Users can read own workout set logs" on public.workout_set_logs for select using (auth.uid() = user_id);
create policy "Users can insert own workout set logs" on public.workout_set_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own workout set logs" on public.workout_set_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own workout set logs" on public.workout_set_logs for delete using (auth.uid() = user_id);

create table if not exists public.workout_schedule (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_date date not null,
  scheduled_time time not null,
  status text not null default 'planned' check (status in ('planned', 'completed', 'rest', 'deferred')),
  original_date date,
  completed_session_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scheduled_date),
  foreign key (completed_session_id, user_id) references public.workout_sessions(id, user_id) on delete cascade
);

create index if not exists workout_schedule_user_date_idx
  on public.workout_schedule (user_id, scheduled_date, scheduled_time);

alter table public.workout_schedule enable row level security;
create policy "Users can read own workout schedule" on public.workout_schedule for select using (auth.uid() = user_id);
create policy "Users can insert own workout schedule" on public.workout_schedule for insert with check (auth.uid() = user_id);
create policy "Users can update own workout schedule" on public.workout_schedule for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own workout schedule" on public.workout_schedule for delete using (auth.uid() = user_id);

create table if not exists public.reminder_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workout_days smallint[] not null default array[1, 3, 5]::smallint[],
  preferred_time time not null default '19:00',
  reminder_minutes_before smallint not null default 30 check (reminder_minutes_before in (10, 30, 60, 120)),
  browser_notifications boolean not null default false,
  timezone text not null default 'Europe/Istanbul' check (timezone = 'Europe/Istanbul'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(workout_days) between 1 and 7),
  check (workout_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[])
);

alter table public.reminder_preferences enable row level security;
create policy "Users can read own reminder preferences" on public.reminder_preferences for select using (auth.uid() = user_id);
create policy "Users can insert own reminder preferences" on public.reminder_preferences for insert with check (auth.uid() = user_id);
create policy "Users can update own reminder preferences" on public.reminder_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own reminder preferences" on public.reminder_preferences for delete using (auth.uid() = user_id);

create table if not exists public.body_measurements (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at date not null default current_date,
  weight_kg numeric(5,2) check (weight_kg > 0 and weight_kg <= 500),
  waist_cm numeric(5,2) check (waist_cm > 0 and waist_cm <= 400),
  hips_cm numeric(5,2) check (hips_cm > 0 and hips_cm <= 400),
  chest_cm numeric(5,2) check (chest_cm > 0 and chest_cm <= 400),
  arm_cm numeric(5,2) check (arm_cm > 0 and arm_cm <= 400),
  thigh_cm numeric(5,2) check (thigh_cm > 0 and thigh_cm <= 400),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, measured_at),
  check (weight_kg is not null or waist_cm is not null or hips_cm is not null or chest_cm is not null or arm_cm is not null or thigh_cm is not null)
);

create index if not exists body_measurements_user_date_idx
  on public.body_measurements (user_id, measured_at desc);

alter table public.body_measurements enable row level security;
create policy "Users can read own body measurements" on public.body_measurements for select using (auth.uid() = user_id);
create policy "Users can insert own body measurements" on public.body_measurements for insert with check (auth.uid() = user_id);
create policy "Users can update own body measurements" on public.body_measurements for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own body measurements" on public.body_measurements for delete using (auth.uid() = user_id);

create table if not exists public.weekly_ai_reviews (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  summary jsonb not null,
  review jsonb not null,
  source text not null check (source in ('ai', 'local')),
  model text,
  input_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists weekly_ai_reviews_user_week_idx
  on public.weekly_ai_reviews (user_id, week_start desc);

alter table public.weekly_ai_reviews enable row level security;
create policy "Users can read own weekly AI reviews" on public.weekly_ai_reviews for select using (auth.uid() = user_id);
create policy "Users can insert own weekly AI reviews" on public.weekly_ai_reviews for insert with check (auth.uid() = user_id);
create policy "Users can update own weekly AI reviews" on public.weekly_ai_reviews for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own weekly AI reviews" on public.weekly_ai_reviews for delete using (auth.uid() = user_id);

create table if not exists public.nutrition_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_type text not null check (goal_type in ('lose', 'maintain', 'gain')),
  calorie_target integer not null check (calorie_target between 800 and 7000),
  protein_g integer not null check (protein_g between 0 and 600),
  carbs_g integer not null check (carbs_g between 0 and 1000),
  fat_g integer not null check (fat_g between 0 and 400),
  bmr integer not null check (bmr between 800 and 4500),
  tdee integer not null check (tdee between 800 and 7000),
  calorie_adjustment integer not null check (calorie_adjustment between -3000 and 3000),
  activity_factor numeric(4,2) not null check (activity_factor between 1.1 and 2.2),
  workout_days smallint not null check (workout_days between 0 and 7),
  is_manual boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nutrition_goals enable row level security;
create policy "Users can read own nutrition goals" on public.nutrition_goals for select using (auth.uid() = user_id);
create policy "Users can insert own nutrition goals" on public.nutrition_goals for insert with check (auth.uid() = user_id);
create policy "Users can update own nutrition goals" on public.nutrition_goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own nutrition goals" on public.nutrition_goals for delete using (auth.uid() = user_id);

create table if not exists public.food_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  consumed_at timestamptz not null default now(),
  meal text not null check (meal in ('Kahvaltı', 'Öğle yemeği', 'Akşam yemeği', 'Atıştırmalık')),
  name text not null,
  calories integer not null check (calories >= 0),
  protein_g numeric(7,2) not null default 0 check (protein_g >= 0),
  carbs_g numeric(7,2) not null default 0 check (carbs_g >= 0),
  fat_g numeric(7,2) not null default 0 check (fat_g >= 0),
  fiber_g numeric(7,2) not null default 0 check (fiber_g >= 0),
  grams numeric(8,2) check (grams > 0),
  micros jsonb not null default '{}'::jsonb,
  source text not null check (source in ('Barkod', 'Fotoğraf', 'Manuel')),
  barcode text,
  created_at timestamptz not null default now()
);

alter table public.food_entries add column if not exists fiber_g numeric(7,2) not null default 0 check (fiber_g >= 0);
alter table public.food_entries add column if not exists grams numeric(8,2) check (grams > 0);
alter table public.food_entries add column if not exists micros jsonb not null default '{}'::jsonb;

create index if not exists food_entries_user_consumed_idx
  on public.food_entries (user_id, consumed_at desc);

alter table public.food_entries enable row level security;
create policy "Users can read own food entries" on public.food_entries for select using (auth.uid() = user_id);
create policy "Users can insert own food entries" on public.food_entries for insert with check (auth.uid() = user_id);
create policy "Users can delete own food entries" on public.food_entries for delete using (auth.uid() = user_id);

-- Daily activity streaks are updated only by the server-side RPCs/trigger in
-- db/migrations/20260722_activity_streaks.sql. Direct writes stay unavailable
-- to clients so duplicate same-day records cannot increase a streak.
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
create policy "Users can read own streak" on public.user_streaks for select using (auth.uid() = user_id);
create policy "Users can read own activities" on public.activity_logs for select using (auth.uid() = user_id);

-- Detailed walking and sport journal entries are stored separately from the
-- daily streak ledger. This allows multiple activities per day without ever
-- increasing the streak more than once.
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

create index if not exists sport_activity_entries_user_date_idx on public.sport_activity_entries (user_id, local_date desc, occurred_at desc);
create unique index if not exists sport_activity_entries_external_idx on public.sport_activity_entries (user_id, provider, external_activity_id) where provider is not null and external_activity_id is not null;
alter table public.sport_activity_entries enable row level security;
create policy "Users can read own sport activities" on public.sport_activity_entries for select using (auth.uid() = user_id);
create policy "Users can insert own sport activities" on public.sport_activity_entries for insert with check (auth.uid() = user_id);
create policy "Users can update own sport activities" on public.sport_activity_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own sport activities" on public.sport_activity_entries for delete using (auth.uid() = user_id);
