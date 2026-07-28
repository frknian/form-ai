-- Sürümlü Türk yemeği tarifleri, pişmiş ağırlık bazlı besin hesabı ve kaynak izi.
-- TürKomp için otomatik veri çekmez; yalnızca izin/lisans kaydı için alan açar.
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create table if not exists public.nutrition_sources (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  homepage_url text,
  license_name text,
  license_url text,
  attribution_text text,
  access_requires_permission boolean not null default false,
  approved_for_automatic_import boolean not null default false,
  usage_scope text not null default 'reference',
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.nutrition_sources
  (code, name, homepage_url, license_name, license_url, attribution_text, access_requires_permission, approved_for_automatic_import, usage_scope)
values
  ('usda_fdc', 'USDA FoodData Central', 'https://fdc.nal.usda.gov/', 'U.S. Government public data', 'https://www.usa.gov/government-copyright', 'FoodData Central, U.S. Department of Agriculture', false, true, 'ingredient_nutrition'),
  ('open_food_facts', 'Open Food Facts', 'https://world.openfoodfacts.org/', 'Open Database License', 'https://opendatacommons.org/licenses/odbl/1-0/', 'Open Food Facts contributors', false, true, 'barcode_packaged_products_only'),
  ('turkomp', 'TürKomp Ulusal Gıda Kompozisyon Veri Tabanı', 'https://www.turkomp.gov.tr/', null, null, null, true, false, 'manual_reference_after_permission'),
  ('form_ai_seed', 'form.ai Türk yemekleri başlangıç kataloğu', null, 'Project data', null, 'İnceleme bekleyen başlangıç tarif tanımları', false, true, 'recipe_metadata_needs_review'),
  ('legacy_form_ai_catalog', 'form.ai eski yerel besin kataloğu', null, 'Project data', null, 'Yalnızca inceleme referansı; doğrulanmış kaynak değildir', false, false, 'legacy_reference_needs_review')
on conflict (code) do update set
  name = excluded.name,
  homepage_url = excluded.homepage_url,
  license_name = excluded.license_name,
  license_url = excluded.license_url,
  attribution_text = excluded.attribution_text,
  access_requires_permission = excluded.access_requires_permission,
  approved_for_automatic_import = excluded.approved_for_automatic_import,
  usage_scope = excluded.usage_scope,
  updated_at = now();

create table if not exists public.recipe_dishes (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 2 and 160),
  alternative_names text[] not null default '{}',
  category text not null check (char_length(trim(category)) between 2 and 80),
  region text,
  description text,
  allergens text[] not null default '{}',
  search_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug)
);

create index if not exists recipe_dishes_search_text_trgm_idx
  on public.recipe_dishes using gin (search_text extensions.gin_trgm_ops);
create index if not exists recipe_dishes_category_region_idx
  on public.recipe_dishes (category, region);

create table if not exists public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.recipe_dishes(id) on delete cascade,
  version text not null check (char_length(trim(version)) between 1 and 40),
  variant_name text,
  default_portion_grams numeric(9,2) check (default_portion_grams > 0 and default_portion_grams <= 5000),
  cooked_weight_grams numeric(10,2) check (cooked_weight_grams > 0 and cooked_weight_grams <= 100000),
  calories_per_100g numeric(9,2) check (calories_per_100g is null or calories_per_100g between 0 and 2000),
  protein_per_100g numeric(8,2) check (protein_per_100g is null or protein_per_100g between 0 and 100),
  carbs_per_100g numeric(8,2) check (carbs_per_100g is null or carbs_per_100g between 0 and 100),
  fat_per_100g numeric(8,2) check (fat_per_100g is null or fat_per_100g between 0 and 100),
  fiber_per_100g numeric(8,2) check (fiber_per_100g is null or fiber_per_100g between 0 and 100),
  source_code text not null references public.nutrition_sources(code),
  source_reference text,
  source_license_snapshot jsonb not null default '{}'::jsonb,
  calculation_method text not null check (calculation_method in ('provider_energy', 'atwater_estimate', 'mixed', 'not_calculated')),
  confidence_level text not null check (confidence_level in ('high', 'medium', 'low')),
  review_status text not null default 'needs_review' check (review_status in ('draft', 'needs_review', 'published', 'archived')),
  data_fingerprint text not null,
  calculation_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dish_id, version),
  unique (data_fingerprint)
);

create index if not exists recipe_versions_dish_status_idx
  on public.recipe_versions (dish_id, review_status, updated_at desc);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references public.recipe_versions(id) on delete cascade,
  position integer not null check (position between 1 and 500),
  ingredient_key text not null check (ingredient_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  ingredient_name text not null check (char_length(trim(ingredient_name)) between 1 and 160),
  raw_weight_grams numeric(9,2) not null check (raw_weight_grams > 0 and raw_weight_grams <= 50000),
  edible_yield_factor numeric(5,4) not null default 1 check (edible_yield_factor between 0 and 1.5),
  nutrient_retention_factor numeric(5,4) not null default 1 check (nutrient_retention_factor between 0 and 1.5),
  source_code text references public.nutrition_sources(code),
  source_id text,
  calories_per_100g numeric(9,2),
  protein_per_100g numeric(8,2),
  carbs_per_100g numeric(8,2),
  fat_per_100g numeric(8,2),
  fiber_per_100g numeric(8,2),
  confidence_level text not null default 'low' check (confidence_level in ('high', 'medium', 'low')),
  allergens text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (recipe_version_id, position),
  unique (recipe_version_id, ingredient_key)
);

create index if not exists recipe_ingredients_version_idx
  on public.recipe_ingredients (recipe_version_id, position);

create table if not exists public.recipe_calculation_runs (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references public.recipe_versions(id) on delete cascade,
  calculator_version text not null,
  calculation_method text not null,
  data_fingerprint text not null,
  input_snapshot jsonb not null,
  output_snapshot jsonb not null,
  warnings text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (recipe_version_id, data_fingerprint)
);

create index if not exists recipe_calculation_runs_version_created_idx
  on public.recipe_calculation_runs (recipe_version_id, created_at desc);

alter table public.food_entries
  add column if not exists recipe_version_id uuid references public.recipe_versions(id) on delete set null;
create index if not exists food_entries_recipe_version_idx
  on public.food_entries (recipe_version_id) where recipe_version_id is not null;

alter table public.nutrition_sources enable row level security;
alter table public.recipe_dishes enable row level security;
alter table public.recipe_versions enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_calculation_runs enable row level security;

drop policy if exists "Authenticated users can read nutrition sources" on public.nutrition_sources;
create policy "Authenticated users can read nutrition sources"
  on public.nutrition_sources for select to authenticated using (true);

drop policy if exists "Authenticated users can read recipe dishes" on public.recipe_dishes;
create policy "Authenticated users can read recipe dishes"
  on public.recipe_dishes for select to authenticated
  using (exists (
    select 1 from public.recipe_versions v
    where v.dish_id = recipe_dishes.id and v.review_status = 'published'
  ));

drop policy if exists "Authenticated users can read published recipe versions" on public.recipe_versions;
create policy "Authenticated users can read published recipe versions"
  on public.recipe_versions for select to authenticated using (review_status = 'published');

drop policy if exists "Authenticated users can read published recipe ingredients" on public.recipe_ingredients;
create policy "Authenticated users can read published recipe ingredients"
  on public.recipe_ingredients for select to authenticated
  using (exists (
    select 1 from public.recipe_versions v
    where v.id = recipe_ingredients.recipe_version_id and v.review_status = 'published'
  ));

drop policy if exists "Authenticated users can read published calculation history" on public.recipe_calculation_runs;
create policy "Authenticated users can read published calculation history"
  on public.recipe_calculation_runs for select to authenticated
  using (exists (
    select 1 from public.recipe_versions v
    where v.id = recipe_calculation_runs.recipe_version_id and v.review_status = 'published'
  ));

create or replace function public.normalize_turkish_food_text(value text)
returns text
language sql immutable parallel safe
set search_path = public, extensions
as $$
  select trim(regexp_replace(
    translate(lower(extensions.unaccent(coalesce(value, ''))), 'ıİşŞğĞçÇöÖüÜ', 'iissggccoouu'),
    '[^a-z0-9]+', ' ', 'g'
  ));
$$;

create or replace function public.search_recipe_versions(p_query text, p_limit integer default 10)
returns table (
  recipe_version_id uuid,
  slug text,
  name text,
  alternative_names text[],
  category text,
  region text,
  description text,
  allergens text[],
  version text,
  variant_name text,
  default_portion_grams numeric,
  cooked_weight_grams numeric,
  calories_per_100g numeric,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fat_per_100g numeric,
  fiber_per_100g numeric,
  confidence_level text,
  calculation_method text
)
language sql stable security invoker
set search_path = public, extensions
as $$
  with normalized as (
    select public.normalize_turkish_food_text(p_query) as q
  )
  select
    v.id, d.slug, d.name, d.alternative_names, d.category, d.region, d.description, d.allergens,
    v.version, v.variant_name, v.default_portion_grams, v.cooked_weight_grams,
    v.calories_per_100g, v.protein_per_100g, v.carbs_per_100g, v.fat_per_100g, v.fiber_per_100g,
    v.confidence_level, v.calculation_method
  from public.recipe_dishes d
  join public.recipe_versions v on v.dish_id = d.id and v.review_status = 'published'
  cross join normalized n
  where auth.uid() is not null
    and char_length(n.q) between 2 and 80
    and (
      d.search_text = n.q
      or d.search_text like '%' || n.q || '%'
      or similarity(d.search_text, n.q) > 0.22
    )
  order by
    (d.search_text = n.q) desc,
    (d.search_text like n.q || '%') desc,
    similarity(d.search_text, n.q) desc,
    v.confidence_level = 'high' desc,
    v.updated_at desc
  limit least(greatest(p_limit, 1), 20);
$$;

grant execute on function public.search_recipe_versions(text, integer) to authenticated;
