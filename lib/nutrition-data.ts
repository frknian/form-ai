import { createClient } from "@supabase/supabase-js";
import { bearerToken } from "./api-auth.ts";
import { mergeFoodResults, normalizeFoodSearchText, type FoodSearchResult } from "./food-search.ts";
import {
  mapOpenFoodFactsProduct,
  mapSupabaseFood,
  mapUsdaFood,
  type FoodNutrition,
  type OpenFoodFactsProduct,
  type SupabaseFoodRow,
} from "./nutrition-model.ts";
import { searchUsdaFoodData } from "./providers/usda-food-data.ts";
import { normalizeSupabaseUrl } from "./supabase/url.ts";

const FOOD_SELECT = "id,canonical_name,display_name_tr,brand,barcode,category,source,source_id,source_url,image_url,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,serving_size_grams,serving_label,data_quality";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

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

function serviceClient() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function findStoredFoodByBarcode(request: Request, barcode: string) {
  const client = userClient(request);
  if (!client) return null;
  const { data, error } = await client.from("foods").select(FOOD_SELECT).eq("barcode", barcode).maybeSingle();
  return error || !data ? null : mapSupabaseFood(data as unknown as SupabaseFoodRow);
}

export async function searchStoredFoods(request: Request, query: string, limit = 12) {
  const client = userClient(request);
  if (!client) return [];
  const { data, error } = await client.rpc("search_foods", {
    p_query: query,
    p_limit: Math.min(30, Math.max(1, limit)),
  });
  if (error || !Array.isArray(data)) return [];
  return data
    .map((row) => mapSupabaseFood(row as SupabaseFoodRow))
    .filter((food): food is FoodNutrition => Boolean(food));
}

type CuisineRecipeRow = {
  id: string;
  slug: string;
  name: string;
  alternative_names?: string[] | null;
  category?: string | null;
  canonical_family?: string | null;
  variant_summary?: string | null;
  confidence?: "low" | "medium" | "high" | null;
  needs_review?: boolean | null;
  allergens?: string[] | null;
  nutrition_per_serving?: {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    fiber?: number;
  } | null;
  match_score?: number | string | null;
};

export async function searchStoredCuisine(request: Request, query: string, limit = 12) {
  const client = userClient(request);
  if (!client) return [];
  const { data, error } = await client.rpc("search_cuisine_recipes", {
    p_query: query,
    p_limit: Math.min(30, Math.max(1, limit)),
  });
  if (error || !Array.isArray(data)) return [];
  return data.map((raw) => {
    const row = raw as CuisineRecipeRow;
    const source = row.nutrition_per_serving;
    const nutritionPerServing = source && Number(source.calories) > 0 ? {
      calories: Number(source.calories),
      protein: Number(source.protein) || 0,
      carbs: Number(source.carbohydrates) || 0,
      fat: Number(source.fat) || 0,
      fiber: Number(source.fiber) || 0,
      micros: {},
    } : null;
    return {
      id: `recipe-${row.id}`,
      name: row.name,
      kind: "recipe" as const,
      aliases: row.alternative_names || [],
      category: row.category || "Türk mutfağı",
      nutritionPer100g: null,
      nutritionPerServing,
      portionLabel: nutritionPerServing ? "Kaynak porsiyonu" : undefined,
      recipeSlug: row.slug,
      canonicalFamily: row.canonical_family || undefined,
      variantSummary: row.variant_summary || undefined,
      allergens: row.allergens || [],
      confidence: row.confidence || "low",
      needsReview: Boolean(row.needs_review),
      source: "FİT.AI besin veritabanı" as const,
      verified: false,
      dataQuality: "provider" as const,
      matchScore: Number(row.match_score) || 0,
    };
  });
}

export async function externalQueryFor(request: Request, query: string) {
  const normalized = normalizeFoodSearchText(query);
  const client = userClient(request);
  if (!client) return query;
  const { data } = await client
    .from("food_query_synonyms")
    .select("external_query")
    .eq("normalized_query", normalized)
    .maybeSingle();
  return typeof data?.external_query === "string" ? data.external_query : query;
}

function providerRow(food: FoodNutrition, rawSourceData: unknown) {
  return {
    canonical_name: food.name,
    display_name_tr: food.name,
    brand: food.brand,
    barcode: food.barcode,
    category: food.category || null,
    source: food.source,
    source_id: food.sourceId || food.barcode || food.id,
    source_url: food.source === "usda" && food.sourceId
      ? `https://fdc.nal.usda.gov/food-details/${food.sourceId}/nutrients`
      : food.source === "open_food_facts" && food.barcode
        ? `https://world.openfoodfacts.org/product/${food.barcode}`
        : null,
    image_url: food.imageUrl,
    calories_per_100g: food.caloriesPer100g,
    protein_per_100g: food.proteinPer100g,
    carbs_per_100g: food.carbohydratesPer100g,
    fat_per_100g: food.fatPer100g,
    fiber_per_100g: food.fiberPer100g,
    serving_size_grams: food.servingSizeGrams,
    serving_label: food.servingLabel,
    data_quality: food.dataQuality === "verified" ? "verified" : "provider",
    raw_source_data: rawSourceData,
    status: "active",
    updated_at: new Date().toISOString(),
  };
}

export async function cacheProviderFood(food: FoodNutrition, rawSourceData: unknown, queryAlias?: string) {
  if (food.source !== "open_food_facts" && food.source !== "usda") return null;
  const client = serviceClient();
  if (!client) return null;
  const { data, error } = await client
    .from("foods")
    .upsert(providerRow(food, rawSourceData), { onConflict: "source,source_id" })
    .select(FOOD_SELECT)
    .single();
  if (error || !data) {
    console.error("[nutrition-cache] food upsert failed", error?.code || "unknown");
    return null;
  }
  if (queryAlias && normalizeFoodSearchText(queryAlias) !== normalizeFoodSearchText(food.name)) {
    await client.from("food_aliases").upsert({
      food_id: data.id,
      alias: queryAlias.trim().slice(0, 160),
      language: "tr",
      source: "user_query",
      priority: 10,
    }, { onConflict: "food_id,normalized_alias,language" });
  }
  return mapSupabaseFood(data as unknown as SupabaseFoodRow);
}

export async function cacheProviderFoods(foods: FoodNutrition[], queryAlias: string) {
  const cached = await Promise.all(foods.map((food) => cacheProviderFood(food, null, queryAlias)));
  return cached.filter((food): food is FoodNutrition => Boolean(food));
}

export async function readSearchCache(query: string, locale = "tr") {
  const client = serviceClient();
  if (!client) return null;
  const normalized = normalizeFoodSearchText(query);
  const { data, error } = await client
    .from("food_search_cache")
    .select("payload,expires_at")
    .eq("provider", "usda")
    .eq("normalized_query", normalized)
    .eq("locale", locale)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data || !Array.isArray(data.payload)) return null;
  return data.payload as FoodSearchResult[];
}

export async function writeSearchCache(query: string, results: FoodSearchResult[], locale = "tr") {
  const client = serviceClient();
  if (!client) return;
  const normalized = normalizeFoodSearchText(query);
  await client.from("food_search_cache").upsert({
    provider: "usda",
    normalized_query: normalized,
    locale,
    payload: results,
    result_count: results.length,
    expires_at: new Date(Date.now() + (results.length > 0 ? CACHE_TTL_MS : 6 * 60 * 60 * 1_000)).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "provider,normalized_query,locale" });
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 2) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8_000) });
      if (response.ok || response.status < 500 || attempt === attempts - 1) return response;
      lastError = new Error(`provider status ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
    }
  }
  throw lastError;
}

export async function findOpenFoodFactsBarcode(barcode: string) {
  const fields = "code,product_name,product_name_tr,brands,serving_size,image_front_url,nutriments";
  const response = await fetchWithRetry(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`,
    { headers: { "User-Agent": "form.ai nutrition tracker/2.0" } },
  );
  if (!response.ok) return null;
  const payload = await response.json() as { status?: number; product?: OpenFoodFactsProduct };
  if (payload.status !== 1 || !payload.product) return null;
  const food = mapOpenFoodFactsProduct({ ...payload.product, code: payload.product.code || barcode });
  return food ? { food, raw: payload.product } : null;
}

export async function searchUsdaFoods(query: string, limit = 10) {
  const foods = await searchUsdaFoodData(query, limit);
  return foods.map(mapUsdaFood).filter((food): food is FoodNutrition => Boolean(food));
}

export function foodToSearchResult(food: FoodNutrition, options: { cacheHit?: boolean } = {}): FoodSearchResult {
  return {
    id: food.id,
    name: food.name,
    brand: food.brand || undefined,
    aliases: food.aliases,
    barcode: food.barcode || undefined,
    imageUrl: food.imageUrl || undefined,
    category: food.category || undefined,
    servingGrams: food.servingSizeGrams || undefined,
    nutritionPer100g: {
      calories: food.caloriesPer100g,
      protein: food.proteinPer100g,
      carbs: food.carbohydratesPer100g,
      fat: food.fatPer100g,
      fiber: food.fiberPer100g,
      micros: {},
    },
    source: food.source === "open_food_facts"
      ? "Open Food Facts"
      : food.source === "usda"
        ? "USDA FoodData Central"
        : "FİT.AI besin veritabanı",
    verified: food.dataQuality === "verified" || food.dataQuality === "provider",
    dataQuality: food.dataQuality,
    matchScore: food.matchScore,
    personalized: food.personalized,
    cacheHit: options.cacheHit,
  };
}

export async function searchFoodCatalog(request: Request, query: string, limit = 12, locale = "tr") {
  const [local, cuisine] = await Promise.all([
    searchStoredFoods(request, query, limit),
    searchStoredCuisine(request, query, limit),
  ]);
  const localResults = mergeFoodResults(local.map((food) => foodToSearchResult(food)), cuisine, limit);
  if (localResults.filter((result) => result.nutritionPer100g).length >= limit) {
    return { results: localResults, cacheHit: false, providerQueried: false };
  }

  const cached = await readSearchCache(query, locale);
  if (cached) {
    return {
      results: mergeFoodResults(localResults, cached.map((result) => ({ ...result, cacheHit: true })), limit),
      cacheHit: true,
      providerQueried: false,
    };
  }

  const externalQuery = await externalQueryFor(request, query);
  const providerFoods = await searchUsdaFoods(externalQuery, limit);
  const storedProviderFoods = await cacheProviderFoods(providerFoods, query);
  const providerResults = (storedProviderFoods.length > 0 ? storedProviderFoods : providerFoods)
    .map((food) => foodToSearchResult(food));
  await writeSearchCache(query, providerResults, locale);
  const refreshed = await searchStoredFoods(request, query, limit);
  return {
    results: mergeFoodResults(
      mergeFoodResults(refreshed.map((food) => foodToSearchResult(food)), cuisine, limit),
      providerResults,
      limit,
    ),
    cacheHit: false,
    providerQueried: true,
  };
}
