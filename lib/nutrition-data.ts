import { createClient } from "@supabase/supabase-js";
import { bearerToken } from "./api-auth.ts";
import { normalizeSupabaseUrl } from "./supabase/url.ts";
import { mapOpenFoodFactsProduct, mapSupabaseFood, mapUsdaFood, type FoodNutrition, type OpenFoodFactsProduct, type SupabaseFoodRow } from "./nutrition-model.ts";
import { searchUsdaFoodData } from "./providers/usda-food-data.ts";

const FOOD_SELECT = "id,canonical_name,display_name_tr,brand,barcode,source,source_id,image_url,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,serving_size_grams,serving_label,verified,data_quality";

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
  if (error || !data) return null;
  return mapSupabaseFood(data as unknown as SupabaseFoodRow);
}

export async function searchStoredFoods(request: Request, query: string, limit = 8) {
  const client = userClient(request);
  if (!client) return [];
  const { data, error } = await client.rpc("search_foods", { p_query: query, p_limit: Math.min(10, Math.max(1, limit)) });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => mapSupabaseFood(row as SupabaseFoodRow)).filter((food): food is FoodNutrition => Boolean(food));
}

export async function cacheProviderFood(food: FoodNutrition, rawSourceData: unknown) {
  if (food.source !== "open_food_facts" && food.source !== "usda") return;
  const client = serviceClient();
  if (!client) return;
  const row = {
    canonical_name: food.name,
    display_name_tr: food.name,
    brand: food.brand,
    barcode: food.barcode,
    source: food.source,
    source_id: food.sourceId,
    image_url: food.imageUrl,
    calories_per_100g: food.caloriesPer100g,
    protein_per_100g: food.proteinPer100g,
    carbs_per_100g: food.carbohydratesPer100g,
    fat_per_100g: food.fatPer100g,
    fiber_per_100g: food.fiberPer100g,
    serving_size_grams: food.servingSizeGrams,
    serving_label: food.servingLabel,
    verified: true,
    data_quality: "provider",
    raw_source_data: rawSourceData,
    updated_at: new Date().toISOString(),
  };
  const lookup = food.barcode
    ? client.from("foods").select("id").eq("barcode", food.barcode).maybeSingle()
    : client.from("foods").select("id").eq("source", food.source).eq("source_id", food.sourceId || "").maybeSingle();
  const { data: existing } = await lookup;
  const operation = existing?.id
    ? client.from("foods").update(row).eq("id", existing.id)
    : client.from("foods").insert(row);
  const { error } = await operation;
  if (error) console.error("[nutrition-cache] food upsert failed", error.code);
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
    { headers: { "User-Agent": "form.ai nutrition tracker/1.0" } },
  );
  if (!response.ok) return null;
  const payload = await response.json() as { status?: number; product?: OpenFoodFactsProduct };
  if (payload.status !== 1 || !payload.product) return null;
  const food = mapOpenFoodFactsProduct({ ...payload.product, code: payload.product.code || barcode });
  return food ? { food, raw: payload.product } : null;
}

export async function searchOpenFoodFacts(query: string, limit = 8) {
  const response = await fetchWithRetry("https://search.openfoodfacts.org/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "form.ai nutrition tracker/1.0" },
    body: JSON.stringify({
      q: query,
      page: 1,
      page_size: Math.min(20, limit),
      langs: ["tr", "en"],
      boost_phrase: true,
      fields: ["code", "product_name", "product_name_tr", "brands", "serving_size", "image_front_url", "nutriments"],
    }),
  });
  if (!response.ok) return [];
  const payload = await response.json() as { hits?: OpenFoodFactsProduct[] };
  return (payload.hits || []).map(mapOpenFoodFactsProduct).filter((food): food is FoodNutrition => Boolean(food));
}

export async function searchUsdaFoods(query: string, limit = 5) {
  const foods = await searchUsdaFoodData(query, limit);
  return foods.map(mapUsdaFood).filter((food): food is FoodNutrition => Boolean(food));
}

export function foodToSearchResult(food: FoodNutrition) {
  return {
    id: food.id,
    name: food.name,
    brand: food.brand || undefined,
    barcode: food.barcode || undefined,
    imageUrl: food.imageUrl || undefined,
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
    verified: food.verified,
    dataQuality: food.dataQuality,
  } as const;
}
