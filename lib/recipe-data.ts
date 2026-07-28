import { createClient } from "@supabase/supabase-js";
import { bearerToken } from "./api-auth.ts";
import { nutritionForRecipeAmount, type NutrientValues } from "./recipe-nutrition.ts";
import { normalizeSupabaseUrl } from "./supabase/url.ts";
import type { FoodSearchResult } from "./food-search.ts";

type RecipeSearchRow = {
  recipe_version_id: string;
  slug: string;
  name: string;
  alternative_names?: string[] | null;
  category: string;
  region?: string | null;
  description?: string | null;
  allergens?: string[] | null;
  version: string;
  variant_name?: string | null;
  default_portion_grams: number | string;
  cooked_weight_grams: number | string;
  calories_per_100g: number | string;
  protein_per_100g: number | string;
  carbs_per_100g: number | string;
  fat_per_100g: number | string;
  fiber_per_100g: number | string;
  confidence_level: "high" | "medium" | "low";
  calculation_method: string;
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

function numeric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function recipeRowToSearchResult(row: RecipeSearchRow): FoodSearchResult | null {
  const calories = numeric(row.calories_per_100g);
  const portion = numeric(row.default_portion_grams);
  if (!row.recipe_version_id || !row.slug || !row.name || calories <= 0 || portion <= 0) return null;
  return {
    id: `recipe-${row.recipe_version_id}`,
    name: row.variant_name ? `${row.name} · ${row.variant_name}` : row.name,
    aliases: row.alternative_names || [],
    kind: "recipe",
    recipeSlug: row.slug,
    recipeVersion: row.version,
    servingGrams: portion,
    portionLabel: "1 porsiyon",
    nutritionPer100g: {
      calories,
      protein: numeric(row.protein_per_100g),
      carbs: numeric(row.carbs_per_100g),
      fat: numeric(row.fat_per_100g),
      fiber: numeric(row.fiber_per_100g),
      micros: {},
    },
    source: "FİT.AI besin veritabanı",
    verified: row.confidence_level === "high",
    dataQuality: row.confidence_level === "high" ? "verified" : "provider",
    confidenceLevel: row.confidence_level,
    allergens: row.allergens || [],
  };
}

export async function searchStoredRecipes(request: Request, query: string, limit = 10) {
  const client = userClient(request);
  if (!client) return [];
  const { data, error } = await client.rpc("search_recipe_versions", {
    p_query: query,
    p_limit: Math.min(20, Math.max(1, limit)),
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
    .select("id,slug,name,alternative_names,category,region,description,allergens")
    .eq("slug", slug)
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
  const per100g: NutrientValues = {
    calories: numeric(recipeVersion.calories_per_100g),
    protein: numeric(recipeVersion.protein_per_100g),
    carbohydrates: numeric(recipeVersion.carbs_per_100g),
    fat: numeric(recipeVersion.fat_per_100g),
    fiber: numeric(recipeVersion.fiber_per_100g),
  };
  return nutritionForRecipeAmount(per100g, {
    ...options,
    defaultPortionGrams: numeric(recipeVersion.default_portion_grams),
  });
}
