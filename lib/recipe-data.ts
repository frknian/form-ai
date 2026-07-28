import { createClient } from "@supabase/supabase-js";
import { bearerToken } from "./api-auth.ts";
import { nutritionForRecipeAmount, type NutrientValues } from "./recipe-nutrition.ts";
import { normalizeSupabaseUrl } from "./supabase/url.ts";
import type { FoodSearchResult } from "./food-search.ts";

type RecipeSearchRow = {
  recipe_version_id?: string | null;
  slug: string;
  name: string;
  alternative_names?: string[] | null;
  category: string;
  subcategory?: string | null;
  region?: string | null;
  regions?: string[] | null;
  provinces?: string[] | null;
  description?: string | null;
  main_ingredients?: string[] | null;
  cooking_methods?: string[] | null;
  dietary_type?: FoodSearchResult["dietaryType"];
  allergens?: string[] | null;
  is_lesser_known?: boolean | null;
  parent_slug?: string | null;
  variant_reason?: string | null;
  version?: string | null;
  variant_name?: string | null;
  default_portion_grams?: number | string | null;
  cooked_weight_grams?: number | string | null;
  calories_per_100g?: number | string | null;
  protein_per_100g?: number | string | null;
  carbs_per_100g?: number | string | null;
  fat_per_100g?: number | string | null;
  fiber_per_100g?: number | string | null;
  sugar_per_100g?: number | string | null;
  sodium_mg_per_100g?: number | string | null;
  confidence_level: "high" | "medium" | "low";
  calculation_method: string;
  nutrition_verified?: boolean | null;
};

export type RecipeSearchFilters = {
  category?: string | null;
  subcategory?: string | null;
  region?: string | null;
  province?: string | null;
  mainIngredient?: string | null;
  dietaryType?: string | null;
  allergen?: string | null;
  cookingMethod?: string | null;
  lesserKnown?: boolean | null;
  nutritionVerified?: boolean | null;
};

function userClient(request: Request) {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = bearerToken(request);
  if (!url || !anonKey || !token) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function numericNullable(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function numeric(value: unknown) {
  return numericNullable(value) ?? 0;
}

export function recipeRowToSearchResult(row: RecipeSearchRow): FoodSearchResult | null {
  if (!row.slug || !row.name) return null;
  const calories = numericNullable(row.calories_per_100g);
  const portion = numericNullable(row.default_portion_grams);
  const nutritionPer100g = calories === null ? null : {
    calories,
    protein: numeric(row.protein_per_100g),
    carbs: numeric(row.carbs_per_100g),
    fat: numeric(row.fat_per_100g),
    fiber: numeric(row.fiber_per_100g),
    micros: {
      ...(numericNullable(row.sugar_per_100g) === null ? {} : { sugarG: numeric(row.sugar_per_100g) }),
      ...(numericNullable(row.sodium_mg_per_100g) === null ? {} : { sodiumMg: numeric(row.sodium_mg_per_100g) }),
    },
  };
  return {
    id: row.recipe_version_id ? `recipe-${row.recipe_version_id}` : `recipe-catalog-${row.slug}`,
    name: row.variant_name ? `${row.name} · ${row.variant_name}` : row.name,
    aliases: row.alternative_names || [],
    kind: "recipe",
    recipeSlug: row.slug,
    recipeVersion: row.version || undefined,
    servingGrams: portion || undefined,
    portionLabel: portion ? "1 porsiyon" : undefined,
    nutritionPer100g,
    source: "FİT.AI besin veritabanı",
    verified: Boolean(row.nutrition_verified),
    dataQuality: row.nutrition_verified ? "verified" : "incomplete",
    confidenceLevel: row.confidence_level,
    allergens: row.allergens || [],
    category: row.category,
    subcategory: row.subcategory || null,
    regions: row.regions || (row.region ? [row.region] : []),
    provinces: row.provinces || [],
    mainIngredients: row.main_ingredients || [],
    cookingMethods: row.cooking_methods || [],
    dietaryType: row.dietary_type || null,
    isLesserKnown: Boolean(row.is_lesser_known),
    parentRecipeSlug: row.parent_slug || null,
    variantReason: row.variant_reason || null,
    nutritionVerified: Boolean(row.nutrition_verified),
  };
}

export async function searchStoredRecipes(
  request: Request,
  query: string,
  limit = 10,
  filters: RecipeSearchFilters = {},
) {
  const client = userClient(request);
  if (!client) return [];
  const { data, error } = await client.rpc("search_recipe_versions", {
    p_query: query,
    p_limit: Math.min(50, Math.max(1, limit)),
    p_category: filters.category || null,
    p_subcategory: filters.subcategory || null,
    p_region: filters.region || null,
    p_province: filters.province || null,
    p_main_ingredient: filters.mainIngredient || null,
    p_dietary_type: filters.dietaryType || null,
    p_allergen: filters.allergen || null,
    p_cooking_method: filters.cookingMethod || null,
    p_lesser_known: filters.lesserKnown ?? null,
    p_nutrition_verified: filters.nutritionVerified ?? null,
  });
  if (error || !Array.isArray(data)) return [];
  return data
    .map((row) => recipeRowToSearchResult(row as RecipeSearchRow))
    .filter((recipe): recipe is FoodSearchResult => Boolean(recipe));
}

export async function getPublishedRecipe(request: Request, slug: string, version?: string | null) {
  const client = userClient(request);
  if (!client) return null;
  const { data: dish, error: dishError } = await client
    .from("recipe_dishes")
    .select("id,slug,name,alternative_names,category,subcategory,region,regions,provinces,description,main_ingredients,cooking_methods,dietary_type,allergens,is_lesser_known,parent_dish_id,variant_reason")
    .eq("slug", slug)
    .neq("catalog_status", "archived")
    .maybeSingle();
  if (dishError || !dish) return null;

  let versionQuery = client
    .from("recipe_versions")
    .select("*")
    .eq("dish_id", dish.id)
    .eq("review_status", "published")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (version) versionQuery = versionQuery.eq("version", version);
  const { data: versions, error: versionError } = await versionQuery;
  const recipeVersion = versions?.[0];
  if (versionError || !recipeVersion) return null;

  const [{ data: ingredients }, { data: calculationRuns }, { data: source }] = await Promise.all([
    client.from("recipe_ingredients").select("*").eq("recipe_version_id", recipeVersion.id).order("position"),
    client.from("recipe_calculation_runs").select("calculator_version,calculation_method,warnings,created_at").eq("recipe_version_id", recipeVersion.id).order("created_at", { ascending: false }).limit(10),
    client.from("nutrition_sources").select("code,name,homepage_url,license_name,license_url,attribution_text,usage_scope").eq("code", recipeVersion.source_code).maybeSingle(),
  ]);

  return { dish, version: recipeVersion, ingredients: ingredients || [], calculationRuns: calculationRuns || [], source };
}

export function calculateStoredRecipeAmount(recipeVersion: Record<string, unknown>, options: { grams?: number; portions?: number }) {
  const calories = numericNullable(recipeVersion.calories_per_100g);
  const portion = numericNullable(recipeVersion.default_portion_grams);
  if (calories === null || portion === null) throw new Error("Tarif besin veya porsiyon değeri doğrulanmamış.");
  const per100g: NutrientValues = {
    calories,
    protein: numeric(recipeVersion.protein_per_100g),
    carbohydrates: numeric(recipeVersion.carbs_per_100g),
    fat: numeric(recipeVersion.fat_per_100g),
    fiber: numeric(recipeVersion.fiber_per_100g),
    ...(numericNullable(recipeVersion.sugar_per_100g) === null ? {} : { sugar: numeric(recipeVersion.sugar_per_100g) }),
    ...(numericNullable(recipeVersion.sodium_mg_per_100g) === null ? {} : { sodiumMg: numeric(recipeVersion.sodium_mg_per_100g) }),
  };
  return nutritionForRecipeAmount(per100g, { ...options, defaultPortionGrams: portion });
}
