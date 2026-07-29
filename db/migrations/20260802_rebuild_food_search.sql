-- form.ai besin aramasını tek kanonik katalog üzerinde sıfırdan kurar.
-- Kullanıcı öğün geçmişi korunur; yalnız eski katalog ve tarif verileri silinir.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

alter table if exists public.food_entries drop constraint if exists food_entries_food_id_fkey;
alter table if exists public.food_entries drop constraint if exists food_entries_recipe_version_id_fkey;
alter table if exists public.food_entries drop column if exists recipe_version_id;
update public.food_entries set food_id = null where food_id is not null;

drop function if exists public.search_recipe_versions(text, integer) cascade;
drop function if exists public.search_recipe_versions(text, integer, text, text, text, text, text, text, text, text, boolean, boolean) cascade;
drop function if exists public.search_foods(text, integer) cascade;
drop table if exists public.recipe_calculation_runs cascade;
drop table if exists public.recipe_ingredients cascade;
drop table if exists public.recipe_versions cascade;
drop table if exists public.recipe_dishes cascade;
drop table if exists public.nutrition_sources cascade;
drop table if exists public.food_aliases cascade;
drop table if exists public.foods cascade;

create or replace function public.normalize_food_text(value text)
returns text
language sql immutable parallel safe
set search_path = public, extensions
as $$
  select trim(regexp_replace(
    translate(lower(extensions.unaccent(coalesce(value, ''))), 'ıİşŞğĞçÇöÖüÜ', 'iissggccoouu'),
    '[^a-z0-9]+', ' ', 'g'
  ));
$$;

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (char_length(trim(canonical_name)) between 1 and 160),
  display_name_tr text not null check (char_length(trim(display_name_tr)) between 1 and 160),
  normalized_name text generated always as (public.normalize_food_text(display_name_tr)) stored,
  brand text,
  barcode text,
  category text,
  source text not null check (source in ('usda', 'open_food_facts', 'admin', 'user')),
  source_id text not null,
  source_url text,
  image_url text,
  calories_per_100g numeric(8,2) not null check (calories_per_100g between 0 and 2000),
  protein_per_100g numeric(7,2) not null default 0 check (protein_per_100g between 0 and 100),
  carbs_per_100g numeric(7,2) not null default 0 check (carbs_per_100g between 0 and 100),
  fat_per_100g numeric(7,2) not null default 0 check (fat_per_100g between 0 and 100),
  fiber_per_100g numeric(7,2) not null default 0 check (fiber_per_100g between 0 and 100),
  serving_size_grams numeric(8,2) check (serving_size_grams between 1 and 5000),
  serving_label text,
  data_quality text not null default 'provider' check (data_quality in ('verified', 'provider', 'user_entered')),
  raw_source_data jsonb,
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create unique index foods_barcode_unique_idx on public.foods (barcode) where barcode is not null;
create index foods_normalized_name_trgm_idx on public.foods using gin (normalized_name extensions.gin_trgm_ops);
create index foods_category_idx on public.foods (category) where status = 'active';

create table public.food_aliases (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  alias text not null check (char_length(trim(alias)) between 1 and 160),
  normalized_alias text generated always as (public.normalize_food_text(alias)) stored,
  language text not null default 'tr' check (char_length(language) between 2 and 12),
  source text not null default 'system' check (source in ('system', 'provider', 'user_query')),
  priority integer not null default 0 check (priority between -100 and 100),
  created_at timestamptz not null default now(),
  unique (food_id, normalized_alias, language)
);

create index food_aliases_normalized_trgm_idx on public.food_aliases using gin (normalized_alias extensions.gin_trgm_ops);
create index food_aliases_food_priority_idx on public.food_aliases (food_id, priority desc);

create table public.food_query_synonyms (
  normalized_query text primary key,
  external_query text not null,
  language text not null default 'tr',
  created_at timestamptz not null default now()
);

insert into public.food_query_synonyms (normalized_query, external_query) values
  ('yumurta', 'egg'),
  ('tavuk', 'chicken'),
  ('pirinc', 'rice'),
  ('bulgur', 'bulgur'),
  ('yogurt', 'yogurt'),
  ('sut', 'milk'),
  ('peynir', 'cheese'),
  ('ekmek', 'bread'),
  ('makarna', 'pasta'),
  ('patates', 'potato'),
  ('mercimek', 'lentil'),
  ('nohut', 'chickpea'),
  ('fasulye', 'bean'),
  ('sucuk', 'sausage'),
  ('sucuklu yumurta', 'eggs with sausage'),
  ('sucuk yumurta', 'eggs with sausage'),
  ('pastirmali yumurta', 'eggs with cured beef'),
  ('menemen', 'scrambled eggs with tomato and pepper'),
  ('mercimek corbasi', 'lentil soup'),
  ('ezogelin corbasi', 'red lentil bulgur soup'),
  ('tarhana corbasi', 'tarhana soup'),
  ('tavuk corbasi', 'chicken soup'),
  ('kuru fasulye', 'white bean stew'),
  ('nohut yemegi', 'chickpea stew'),
  ('taze fasulye', 'green bean stew'),
  ('bezelye yemegi', 'pea stew'),
  ('bulgur pilavi', 'cooked bulgur'),
  ('pirinc pilavi', 'cooked white rice'),
  ('firin makarna', 'baked pasta'),
  ('kiymali makarna', 'pasta with ground beef'),
  ('tavuk sis', 'grilled chicken skewer'),
  ('doner', 'doner kebab'),
  ('et doner', 'beef doner kebab'),
  ('tavuk doner', 'chicken doner kebab'),
  ('adana kebap', 'ground lamb kebab'),
  ('urfa kebap', 'ground lamb kebab'),
  ('lahmacun', 'turkish flatbread with ground meat'),
  ('pide', 'turkish pide'),
  ('manti', 'turkish meat dumplings'),
  ('icli kofte', 'stuffed bulgur meatball'),
  ('yaprak sarma', 'stuffed grape leaves'),
  ('biber dolmasi', 'stuffed pepper'),
  ('ayran', 'yogurt drink'),
  ('cacik', 'yogurt cucumber dip'),
  ('sutlac', 'rice pudding'),
  ('baklava', 'baklava')
on conflict (normalized_query) do update set external_query = excluded.external_query;

create table public.food_search_cache (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('usda', 'open_food_facts')),
  normalized_query text not null,
  locale text not null default 'tr',
  payload jsonb not null,
  result_count integer not null default 0 check (result_count >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, normalized_query, locale)
);

create index food_search_cache_expiry_idx on public.food_search_cache (expires_at);

create table public.food_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  normalized_query text not null,
  portion_grams numeric(8,2) check (portion_grams is null or portion_grams between 1 and 5000),
  meal_type text check (meal_type is null or char_length(meal_type) <= 40),
  selected_at timestamptz not null default now()
);

create index food_selections_user_recent_idx on public.food_selections (user_id, selected_at desc);
create index food_selections_user_food_idx on public.food_selections (user_id, food_id, selected_at desc);

create table public.food_user_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  selection_count integer not null default 1 check (selection_count > 0),
  last_query text not null default '',
  last_selected_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

alter table public.food_entries
  add constraint food_entries_food_id_fkey
  foreign key (food_id) references public.foods(id) on delete set null;

alter table public.foods enable row level security;
alter table public.food_aliases enable row level security;
alter table public.food_query_synonyms enable row level security;
alter table public.food_search_cache enable row level security;
alter table public.food_selections enable row level security;
alter table public.food_user_preferences enable row level security;

create policy "Authenticated users read active foods"
  on public.foods for select to authenticated using (status = 'active');
create policy "Authenticated users read aliases"
  on public.food_aliases for select to authenticated
  using (exists (select 1 from public.foods food where food.id = food_aliases.food_id and food.status = 'active'));
create policy "Authenticated users read query synonyms"
  on public.food_query_synonyms for select to authenticated using (true);
create policy "Users read own food selections"
  on public.food_selections for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own food selections"
  on public.food_selections for insert to authenticated with check (auth.uid() = user_id);
create policy "Users read own food preferences"
  on public.food_user_preferences for select to authenticated using (auth.uid() = user_id);

create or replace function public.search_foods(p_query text, p_limit integer default 12)
returns table (
  id uuid,
  canonical_name text,
  display_name_tr text,
  brand text,
  barcode text,
  category text,
  source text,
  source_id text,
  source_url text,
  image_url text,
  calories_per_100g numeric,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fat_per_100g numeric,
  fiber_per_100g numeric,
  serving_size_grams numeric,
  serving_label text,
  data_quality text,
  aliases text[],
  match_score numeric,
  personalized boolean
)
language sql stable security invoker
set search_path = public, extensions
as $$
  with query as (
    select public.normalize_food_text(p_query) as normalized
  ),
  ranked as (
    select
      food.*,
      coalesce(alias_match.aliases, '{}'::text[]) as aliases,
      greatest(
        case when food.normalized_name = query.normalized then 1.0 else 0 end,
        case when food.normalized_name like query.normalized || '%' then 0.92 else 0 end,
        extensions.similarity(food.normalized_name, query.normalized),
        coalesce(alias_match.score, 0)
      ) + least(0.15, ln(1 + coalesce(preference.selection_count, 0)) * 0.04) as score,
      coalesce(preference.selection_count, 0) > 0 as is_personalized
    from public.foods food
    cross join query
    left join lateral (
      select
        array_agg(alias.alias order by alias.priority desc) as aliases,
        max(greatest(
          case when alias.normalized_alias = query.normalized then 0.98 else 0 end,
          case when alias.normalized_alias like query.normalized || '%' then 0.90 else 0 end,
          extensions.similarity(alias.normalized_alias, query.normalized)
        )) as score
      from public.food_aliases alias
      where alias.food_id = food.id
    ) alias_match on true
    left join public.food_user_preferences preference
      on preference.food_id = food.id and preference.user_id = auth.uid()
    where food.status = 'active'
      and char_length(query.normalized) between 2 and 80
      and (
        food.normalized_name like '%' || query.normalized || '%'
        or extensions.similarity(food.normalized_name, query.normalized) >= 0.20
        or coalesce(alias_match.score, 0) >= 0.20
      )
  )
  select
    ranked.id,
    ranked.canonical_name,
    ranked.display_name_tr,
    ranked.brand,
    ranked.barcode,
    ranked.category,
    ranked.source,
    ranked.source_id,
    ranked.source_url,
    ranked.image_url,
    ranked.calories_per_100g,
    ranked.protein_per_100g,
    ranked.carbs_per_100g,
    ranked.fat_per_100g,
    ranked.fiber_per_100g,
    ranked.serving_size_grams,
    ranked.serving_label,
    ranked.data_quality,
    ranked.aliases,
    round(ranked.score::numeric, 4),
    ranked.is_personalized
  from ranked
  order by ranked.score desc, ranked.display_name_tr
  limit least(greatest(p_limit, 1), 30);
$$;

create or replace function public.record_food_selection(
  p_food_id uuid,
  p_query text,
  p_portion_grams numeric default null,
  p_meal_type text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized text := public.normalize_food_text(p_query);
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.foods where id = p_food_id and status = 'active') then
    raise exception 'food not found';
  end if;
  if char_length(normalized) < 2 or char_length(normalized) > 80 then
    raise exception 'invalid query';
  end if;

  insert into public.food_selections (user_id, food_id, normalized_query, portion_grams, meal_type)
  values (current_user_id, p_food_id, normalized, p_portion_grams, nullif(trim(p_meal_type), ''));

  insert into public.food_user_preferences (user_id, food_id, selection_count, last_query, last_selected_at)
  values (current_user_id, p_food_id, 1, normalized, now())
  on conflict (user_id, food_id) do update set
    selection_count = food_user_preferences.selection_count + 1,
    last_query = excluded.last_query,
    last_selected_at = excluded.last_selected_at;
end;
$$;

revoke all on function public.search_foods(text, integer) from public;
revoke all on function public.record_food_selection(uuid, text, numeric, text) from public;
grant execute on function public.search_foods(text, integer) to authenticated;
grant execute on function public.record_food_selection(uuid, text, numeric, text) to authenticated;
