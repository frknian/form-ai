-- 500 kayıtlık Türk yemeği kataloğu için geriye uyumlu metadata genişletmesi.
-- Besin alanları nullable kalır; doğrulanmamış kayıtlar katalogda görünür ancak
-- kalori/makro değeri varmış gibi sunulmaz.

insert into public.nutrition_sources
  (code, name, homepage_url, license_name, license_url, attribution_text, access_requires_permission, approved_for_automatic_import, usage_scope)
values
  (
    'culture_portal',
    'T.C. Kültür ve Turizm Bakanlığı Kültür Portalı',
    'https://www.kulturportali.gov.tr/',
    null,
    null,
    'T.C. Kültür ve Turizm Bakanlığı Kültür Portalı',
    false,
    false,
    'dish_name_region_reference_only'
  )
on conflict (code) do update set
  name = excluded.name,
  homepage_url = excluded.homepage_url,
  attribution_text = excluded.attribution_text,
  usage_scope = excluded.usage_scope,
  updated_at = now();

alter table public.recipe_dishes
  add column if not exists normalized_name text,
  add column if not exists subcategory text,
  add column if not exists regions text[] not null default '{}',
  add column if not exists provinces text[] not null default '{}',
  add column if not exists districts text[] not null default '{}',
  add column if not exists cuisine_traditions text[] not null default '{}',
  add column if not exists historical_note text,
  add column if not exists main_ingredients text[] not null default '{}',
  add column if not exists cooking_methods text[] not null default '{}',
  add column if not exists serving_temperature text,
  add column if not exists meal_types text[] not null default '{}',
  add column if not exists dietary_type text,
  add column if not exists source_type text,
  add column if not exists sources jsonb not null default '[]'::jsonb,
  add column if not exists is_regional boolean not null default false,
  add column if not exists is_lesser_known boolean not null default false,
  add column if not exists parent_dish_id uuid,
  add column if not exists variant_reason text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists catalog_status text not null default 'hidden';

update public.recipe_dishes
set normalized_name = public.normalize_turkish_food_text(name)
where normalized_name is null or normalized_name = '';

alter table public.recipe_dishes
  alter column normalized_name set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recipe_dishes_parent_dish_id_fkey'
      and conrelid = 'public.recipe_dishes'::regclass
  ) then
    alter table public.recipe_dishes
      add constraint recipe_dishes_parent_dish_id_fkey
      foreign key (parent_dish_id) references public.recipe_dishes(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'recipe_dishes_serving_temperature_check'
      and conrelid = 'public.recipe_dishes'::regclass
  ) then
    alter table public.recipe_dishes
      add constraint recipe_dishes_serving_temperature_check
      check (serving_temperature is null or serving_temperature in ('hot', 'cold', 'both'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'recipe_dishes_dietary_type_check'
      and conrelid = 'public.recipe_dishes'::regclass
  ) then
    alter table public.recipe_dishes
      add constraint recipe_dishes_dietary_type_check
      check (dietary_type is null or dietary_type in ('meat', 'poultry', 'fish', 'vegetarian', 'vegan'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'recipe_dishes_catalog_status_check'
      and conrelid = 'public.recipe_dishes'::regclass
  ) then
    alter table public.recipe_dishes
      add constraint recipe_dishes_catalog_status_check
      check (catalog_status in ('hidden', 'visible', 'archived'));
  end if;
end
$$;

alter table public.recipe_versions
  add column if not exists sugar_per_100g numeric(8,2)
    check (sugar_per_100g is null or sugar_per_100g between 0 and 100),
  add column if not exists sodium_mg_per_100g numeric(10,2)
    check (sodium_mg_per_100g is null or sodium_mg_per_100g between 0 and 100000);

create index if not exists recipe_dishes_normalized_name_trgm_idx
  on public.recipe_dishes using gin (normalized_name extensions.gin_trgm_ops);
create index if not exists recipe_dishes_regions_idx on public.recipe_dishes using gin (regions);
create index if not exists recipe_dishes_provinces_idx on public.recipe_dishes using gin (provinces);
create index if not exists recipe_dishes_main_ingredients_idx on public.recipe_dishes using gin (main_ingredients);
create index if not exists recipe_dishes_cooking_methods_idx on public.recipe_dishes using gin (cooking_methods);
create index if not exists recipe_dishes_tags_idx on public.recipe_dishes using gin (tags);
create index if not exists recipe_dishes_catalog_filters_idx
  on public.recipe_dishes (catalog_status, category, dietary_type, is_lesser_known);
create index if not exists recipe_dishes_parent_idx
  on public.recipe_dishes (parent_dish_id) where parent_dish_id is not null;

drop policy if exists "Authenticated users can read recipe dishes" on public.recipe_dishes;
create policy "Authenticated users can read recipe dishes"
  on public.recipe_dishes for select to authenticated
  using (
    catalog_status = 'visible'
    or exists (
      select 1 from public.recipe_versions v
      where v.dish_id = recipe_dishes.id and v.review_status = 'published'
    )
  );

drop function if exists public.search_recipe_versions(text, integer);
create or replace function public.search_recipe_versions(
  p_query text,
  p_limit integer default 10,
  p_category text default null,
  p_subcategory text default null,
  p_region text default null,
  p_province text default null,
  p_main_ingredient text default null,
  p_dietary_type text default null,
  p_allergen text default null,
  p_cooking_method text default null,
  p_lesser_known boolean default null,
  p_nutrition_verified boolean default null
)
returns table (
  recipe_version_id uuid,
  slug text,
  name text,
  alternative_names text[],
  category text,
  subcategory text,
  region text,
  regions text[],
  provinces text[],
  description text,
  main_ingredients text[],
  cooking_methods text[],
  dietary_type text,
  allergens text[],
  is_lesser_known boolean,
  parent_slug text,
  variant_reason text,
  version text,
  variant_name text,
  default_portion_grams numeric,
  cooked_weight_grams numeric,
  calories_per_100g numeric,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fat_per_100g numeric,
  fiber_per_100g numeric,
  sugar_per_100g numeric,
  sodium_mg_per_100g numeric,
  confidence_level text,
  calculation_method text,
  nutrition_verified boolean
)
language sql stable security invoker
set search_path = public, extensions
as $$
  with normalized as (
    select public.normalize_turkish_food_text(p_query) as q
  )
  select
    v.id,
    d.slug,
    d.name,
    d.alternative_names,
    d.category,
    d.subcategory,
    d.region,
    d.regions,
    d.provinces,
    d.description,
    d.main_ingredients,
    d.cooking_methods,
    d.dietary_type,
    d.allergens,
    d.is_lesser_known,
    parent.slug,
    d.variant_reason,
    v.version,
    v.variant_name,
    v.default_portion_grams,
    v.cooked_weight_grams,
    v.calories_per_100g,
    v.protein_per_100g,
    v.carbs_per_100g,
    v.fat_per_100g,
    v.fiber_per_100g,
    v.sugar_per_100g,
    v.sodium_mg_per_100g,
    coalesce(v.confidence_level, 'low'),
    coalesce(v.calculation_method, 'not_calculated'),
    (v.review_status = 'published' and v.calories_per_100g is not null)
  from public.recipe_dishes d
  left join public.recipe_dishes parent on parent.id = d.parent_dish_id
  left join lateral (
    select rv.*
    from public.recipe_versions rv
    where rv.dish_id = d.id and rv.review_status = 'published'
    order by rv.updated_at desc
    limit 1
  ) v on true
  cross join normalized n
  where auth.uid() is not null
    and d.catalog_status = 'visible'
    and char_length(n.q) between 2 and 80
    and (
      d.search_text = n.q
      or d.search_text like '%' || n.q || '%'
      or d.normalized_name like '%' || n.q || '%'
      or similarity(d.search_text, n.q) > 0.22
    )
    and (p_category is null or d.category = p_category)
    and (p_subcategory is null or d.subcategory = p_subcategory)
    and (p_region is null or p_region = any(d.regions))
    and (p_province is null or p_province = any(d.provinces))
    and (
      p_main_ingredient is null
      or exists (
        select 1
        from unnest(d.main_ingredients) value
        where public.normalize_turkish_food_text(value)
          like '%' || public.normalize_turkish_food_text(p_main_ingredient) || '%'
      )
    )
    and (p_dietary_type is null or d.dietary_type = p_dietary_type)
    and (p_allergen is null or p_allergen = any(d.allergens))
    and (p_cooking_method is null or p_cooking_method = any(d.cooking_methods))
    and (p_lesser_known is null or d.is_lesser_known = p_lesser_known)
    and (coalesce(p_nutrition_verified, false) = false or (v.review_status = 'published' and v.calories_per_100g is not null))
  order by
    (d.normalized_name = n.q) desc,
    (d.normalized_name like n.q || '%') desc,
    similarity(d.search_text, n.q) desc,
    (v.review_status = 'published' and v.calories_per_100g is not null) desc,
    d.is_lesser_known desc,
    d.name
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function public.search_recipe_versions(
  text, integer, text, text, text, text, text, text, text, text, boolean, boolean
) to authenticated;
