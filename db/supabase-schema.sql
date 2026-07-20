create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  age smallint,
  gender text,
  height_cm numeric(5,2),
  weight_kg numeric(5,2),
  environment text,
  equipment_text text,
  goal_text text,
  history_answers jsonb not null default '[]'::jsonb,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

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
