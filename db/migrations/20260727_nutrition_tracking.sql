create extension if not exists pg_trgm with schema extensions;

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (char_length(trim(canonical_name)) between 1 and 160),
  display_name_tr text not null check (char_length(trim(display_name_tr)) between 1 and 160),
  brand text,
  barcode text,
  source text not null check (source in ('open_food_facts', 'usda', 'local', 'user_created', 'admin_created', 'ai_estimated')),
  source_id text,
  image_url text,
  calories_per_100g numeric(8,2) not null check (calories_per_100g >= 0 and calories_per_100g <= 2000),
  protein_per_100g numeric(7,2) not null default 0 check (protein_per_100g between 0 and 100),
  carbs_per_100g numeric(7,2) not null default 0 check (carbs_per_100g between 0 and 100),
  fat_per_100g numeric(7,2) not null default 0 check (fat_per_100g between 0 and 100),
  fiber_per_100g numeric(7,2) not null default 0 check (fiber_per_100g between 0 and 100),
  serving_size_grams numeric(8,2) check (serving_size_grams > 0 and serving_size_grams <= 5000),
  serving_label text,
  verified boolean not null default false,
  data_quality text not null default 'incomplete' check (data_quality in ('verified', 'provider', 'estimated', 'user_entered', 'incomplete')),
  raw_source_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists foods_barcode_unique_idx on public.foods (barcode) where barcode is not null;
create unique index if not exists foods_source_id_unique_idx on public.foods (source, source_id) where source_id is not null;
create index if not exists foods_display_name_tr_trgm_idx on public.foods using gin (display_name_tr extensions.gin_trgm_ops);
create index if not exists foods_canonical_name_trgm_idx on public.foods using gin (canonical_name extensions.gin_trgm_ops);

create table if not exists public.food_aliases (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  alias text not null check (char_length(trim(alias)) between 1 and 160),
  language text not null default 'tr' check (char_length(language) between 2 and 12),
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  unique (food_id, alias, language)
);

create index if not exists food_aliases_alias_trgm_idx on public.food_aliases using gin (alias extensions.gin_trgm_ops);
create index if not exists food_aliases_food_priority_idx on public.food_aliases (food_id, priority desc);

alter table public.food_entries add column if not exists food_id uuid references public.foods(id) on delete set null;
alter table public.food_entries add column if not exists logged_date date;
alter table public.food_entries add column if not exists input_method text;
alter table public.food_entries add column if not exists confidence numeric(4,3);
alter table public.food_entries add column if not exists is_estimated boolean not null default false;
alter table public.food_entries add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.food_entries add column if not exists updated_at timestamptz not null default now();

update public.food_entries set logged_date = (consumed_at at time zone 'UTC')::date where logged_date is null;
update public.food_entries set input_method = case source when 'Barkod' then 'barcode' when 'Fotoğraf' then 'photo' else 'manual' end where input_method is null;
alter table public.food_entries alter column logged_date set not null;
alter table public.food_entries alter column logged_date set default current_date;
alter table public.food_entries alter column input_method set not null;
alter table public.food_entries drop constraint if exists food_entries_input_method_check;
alter table public.food_entries add constraint food_entries_input_method_check
  check (input_method in ('barcode', 'search', 'natural_language', 'manual', 'photo', 'recent', 'favorite')) not valid;
alter table public.food_entries validate constraint food_entries_input_method_check;
alter table public.food_entries drop constraint if exists food_entries_confidence_check;
alter table public.food_entries add constraint food_entries_confidence_check
  check (confidence is null or confidence between 0 and 1) not valid;
alter table public.food_entries validate constraint food_entries_confidence_check;

create index if not exists food_entries_user_logged_date_idx on public.food_entries (user_id, logged_date desc, consumed_at desc);
create index if not exists food_entries_food_id_idx on public.food_entries (food_id) where food_id is not null;

alter table public.foods enable row level security;
alter table public.food_aliases enable row level security;
drop policy if exists "Authenticated users can read foods" on public.foods;
create policy "Authenticated users can read foods" on public.foods for select to authenticated using (true);
drop policy if exists "Authenticated users can read food aliases" on public.food_aliases;
create policy "Authenticated users can read food aliases" on public.food_aliases for select to authenticated using (true);

drop policy if exists "Users can update own food entries" on public.food_entries;
create policy "Users can update own food entries" on public.food_entries for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.search_foods(p_query text, p_limit integer default 8)
returns setof public.foods
language sql stable security invoker set search_path = public, extensions as $$
  select f.*
  from public.foods f
  left join public.food_aliases a on a.food_id = f.id
  where auth.uid() is not null
    and char_length(trim(p_query)) between 2 and 80
    and (
      lower(f.display_name_tr) = lower(trim(p_query))
      or lower(f.canonical_name) = lower(trim(p_query))
      or lower(a.alias) = lower(trim(p_query))
      or similarity(f.display_name_tr, trim(p_query)) > 0.22
      or similarity(f.canonical_name, trim(p_query)) > 0.22
      or similarity(a.alias, trim(p_query)) > 0.22
    )
  group by f.id
  order by
    (lower(f.display_name_tr) = lower(trim(p_query))) desc,
    (lower(f.canonical_name) = lower(trim(p_query))) desc,
    max(greatest(
      similarity(f.display_name_tr, trim(p_query)),
      similarity(f.canonical_name, trim(p_query)),
      coalesce(similarity(a.alias, trim(p_query)), 0)
    )) desc,
    f.verified desc
  limit least(greatest(p_limit, 1), 10);
$$;

grant execute on function public.search_foods(text, integer) to authenticated;
