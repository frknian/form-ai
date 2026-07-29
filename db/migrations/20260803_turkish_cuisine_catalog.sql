-- Kaynak porsiyon besinleri ile doğrulanmış 100 g besinlerini birbirine karıştırmadan
-- en az 1.000 Türk yemeğini saklayacak katalog ayrıntıları.

alter table public.foods alter column calories_per_100g drop not null;
alter table public.foods alter column protein_per_100g drop not null;
alter table public.foods alter column carbs_per_100g drop not null;
alter table public.foods alter column fat_per_100g drop not null;
alter table public.foods alter column fiber_per_100g drop not null;

alter table public.foods
  add column if not exists nutrition_basis text not null default 'per_100g'
    check (nutrition_basis in ('per_100g', 'per_serving_source_reported')),
  add column if not exists calories_per_serving numeric(8,2)
    check (calories_per_serving is null or calories_per_serving between 0 and 5000),
  add column if not exists protein_per_serving numeric(8,2)
    check (protein_per_serving is null or protein_per_serving between 0 and 500),
  add column if not exists carbs_per_serving numeric(8,2)
    check (carbs_per_serving is null or carbs_per_serving between 0 and 1000),
  add column if not exists fat_per_serving numeric(8,2)
    check (fat_per_serving is null or fat_per_serving between 0 and 500),
  add column if not exists fiber_per_serving numeric(8,2)
    check (fiber_per_serving is null or fiber_per_serving between 0 and 500),
  add column if not exists confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high')),
  add column if not exists needs_review boolean not null default false;

alter table public.foods drop constraint if exists foods_nutrition_basis_values_check;
alter table public.foods add constraint foods_nutrition_basis_values_check check (
  (
    nutrition_basis = 'per_100g'
    and calories_per_100g is not null
    and protein_per_100g is not null
    and carbs_per_100g is not null
    and fat_per_100g is not null
    and fiber_per_100g is not null
  )
  or (
    nutrition_basis = 'per_serving_source_reported'
    and calories_per_serving is not null
    and protein_per_serving is not null
    and carbs_per_serving is not null
    and fat_per_serving is not null
    and fiber_per_serving is not null
  )
);

create table if not exists public.cuisine_recipes (
  id uuid primary key default gen_random_uuid(),
  food_id uuid unique references public.foods(id) on delete cascade,
  slug text not null unique,
  name text not null,
  normalized_name text generated always as (public.normalize_food_text(name)) stored,
  alternative_names text[] not null default '{}',
  category text not null default 'Türk mutfağı',
  canonical_family text,
  variant_summary text,
  region text,
  province text,
  description text,
  servings numeric(7,2) check (servings is null or servings between 0.1 and 1000),
  cooked_weight_grams numeric(9,2) check (cooked_weight_grams is null or cooked_weight_grams between 1 and 100000),
  prep_time text,
  cook_time text,
  total_time text,
  recipe_version text not null,
  calculation_method text not null check (calculation_method in ('source_reported', 'ingredient_calculated', 'ingredient_calculation_pending', 'macro_estimate')),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  needs_review boolean not null default true,
  catalog_status text not null default 'pending'
    check (catalog_status in ('pending', 'published', 'rejected')),
  allergens text[] not null default '{}',
  source_dataset text not null,
  source_url text not null,
  source_license text,
  source_record_split text,
  source_record_index integer,
  source_attribution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cuisine_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.cuisine_recipes(id) on delete cascade,
  position integer not null check (position >= 0),
  amount_text text not null,
  grams numeric(9,2) check (grams is null or grams between 0 and 100000),
  gram_status text not null check (gram_status in ('source_explicit', 'needs_review')),
  ingredient_food_id uuid references public.foods(id) on delete set null,
  unique (recipe_id, position)
);

create table if not exists public.cuisine_recipe_calculations (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.cuisine_recipes(id) on delete cascade,
  recipe_version text not null,
  method text not null,
  input_snapshot jsonb not null,
  output_snapshot jsonb not null,
  confidence text not null,
  created_at timestamptz not null default now(),
  unique (recipe_id, recipe_version, method)
);

create index if not exists cuisine_recipes_region_idx on public.cuisine_recipes (region);
create index if not exists cuisine_recipes_province_idx on public.cuisine_recipes (province);
create index if not exists cuisine_recipes_normalized_name_trgm_idx
  on public.cuisine_recipes using gin (normalized_name extensions.gin_trgm_ops);
create index if not exists cuisine_recipe_ingredients_food_idx
  on public.cuisine_recipe_ingredients (ingredient_food_id)
  where ingredient_food_id is not null;

alter table public.cuisine_recipes enable row level security;
alter table public.cuisine_recipe_ingredients enable row level security;
alter table public.cuisine_recipe_calculations enable row level security;

drop policy if exists "Authenticated users read cuisine recipes" on public.cuisine_recipes;
create policy "Authenticated users read cuisine recipes"
  on public.cuisine_recipes for select to authenticated using (true);
drop policy if exists "Authenticated users read cuisine ingredients" on public.cuisine_recipe_ingredients;
create policy "Authenticated users read cuisine ingredients"
  on public.cuisine_recipe_ingredients for select to authenticated using (true);
drop policy if exists "Authenticated users read cuisine calculations" on public.cuisine_recipe_calculations;
create policy "Authenticated users read cuisine calculations"
  on public.cuisine_recipe_calculations for select to authenticated using (true);

drop function if exists public.search_foods(text, integer);
create function public.search_foods(p_query text, p_limit integer default 12)
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
  nutrition_basis text,
  calories_per_serving numeric,
  protein_per_serving numeric,
  carbs_per_serving numeric,
  fat_per_serving numeric,
  fiber_per_serving numeric,
  confidence text,
  needs_review boolean,
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
    ranked.id, ranked.canonical_name, ranked.display_name_tr, ranked.brand,
    ranked.barcode, ranked.category, ranked.source, ranked.source_id,
    ranked.source_url, ranked.image_url, ranked.calories_per_100g,
    ranked.protein_per_100g, ranked.carbs_per_100g, ranked.fat_per_100g,
    ranked.fiber_per_100g, ranked.serving_size_grams, ranked.serving_label,
    ranked.data_quality, ranked.nutrition_basis, ranked.calories_per_serving,
    ranked.protein_per_serving, ranked.carbs_per_serving, ranked.fat_per_serving,
    ranked.fiber_per_serving, ranked.confidence, ranked.needs_review,
    ranked.aliases, round(ranked.score::numeric, 4), ranked.is_personalized
  from ranked
  order by ranked.score desc, ranked.display_name_tr
  limit least(greatest(p_limit, 1), 30);
$$;

revoke all on function public.search_foods(text, integer) from public;
grant execute on function public.search_foods(text, integer) to authenticated;

create or replace function public.search_cuisine_recipes(p_query text, p_limit integer default 12)
returns table (
  id uuid,
  slug text,
  name text,
  alternative_names text[],
  category text,
  canonical_family text,
  variant_summary text,
  region text,
  province text,
  servings numeric,
  cooked_weight_grams numeric,
  recipe_version text,
  calculation_method text,
  confidence text,
  needs_review boolean,
  catalog_status text,
  allergens text[],
  source_url text,
  source_license text,
  nutrition_per_serving jsonb,
  match_score numeric
)
language sql stable security invoker
set search_path = public, extensions
as $$
  with query as (
    select public.normalize_food_text(p_query) as normalized
  )
  select
    recipe.id, recipe.slug, recipe.name, recipe.alternative_names, recipe.category,
    recipe.canonical_family, recipe.variant_summary, recipe.region, recipe.province,
    recipe.servings, recipe.cooked_weight_grams, recipe.recipe_version,
    recipe.calculation_method, recipe.confidence, recipe.needs_review,
    recipe.catalog_status, recipe.allergens, recipe.source_url, recipe.source_license,
    calculation.output_snapshot -> 'perServing',
    round(greatest(
      case when recipe.normalized_name = query.normalized then 1.0 else 0 end,
      case when recipe.normalized_name like query.normalized || '%' then 0.92 else 0 end,
      extensions.similarity(recipe.normalized_name, query.normalized),
      coalesce((
        select max(extensions.similarity(public.normalize_food_text(alias), query.normalized))
        from unnest(recipe.alternative_names) alias
      ), 0)
    )::numeric, 4)
  from public.cuisine_recipes recipe
  cross join query
  left join lateral (
    select output_snapshot
    from public.cuisine_recipe_calculations calculation_row
    where calculation_row.recipe_id = recipe.id
    order by calculation_row.created_at desc
    limit 1
  ) calculation on true
  where recipe.catalog_status in ('pending', 'published')
    and char_length(query.normalized) between 2 and 80
    and (
      recipe.normalized_name like '%' || query.normalized || '%'
      or extensions.similarity(recipe.normalized_name, query.normalized) >= 0.20
      or exists (
        select 1 from unnest(recipe.alternative_names) alias
        where extensions.similarity(public.normalize_food_text(alias), query.normalized) >= 0.20
      )
    )
  order by 21 desc, recipe.needs_review, recipe.name
  limit least(greatest(p_limit, 1), 30);
$$;

revoke all on function public.search_cuisine_recipes(text, integer) from public;
grant execute on function public.search_cuisine_recipes(text, integer) to authenticated;
