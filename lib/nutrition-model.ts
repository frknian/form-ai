import type { FoodNutrition as LegacyFoodNutrition } from "./food-search.ts";

export const FOOD_SOURCES = [
  "open_food_facts",
  "usda",
  "admin",
  "user",
] as const;

export type FoodSource = (typeof FOOD_SOURCES)[number];
export type FoodDataQuality = "verified" | "provider" | "user_entered";

export type FoodNutrition = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  imageUrl: string | null;
  source: FoodSource;
  sourceId: string | null;
  servingSizeGrams: number | null;
  servingLabel: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbohydratesPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  verified: boolean;
  dataQuality: FoodDataQuality;
  category?: string | null;
  aliases?: string[];
  matchScore?: number;
  personalized?: boolean;
};

export type PortionNutrition = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
};

export type OpenFoodFactsProduct = {
  code?: string;
  product_name?: string;
  product_name_tr?: string;
  brands?: string[] | string;
  serving_size?: string;
  image_front_url?: string;
  nutriments?: Record<string, unknown>;
};

export type UsdaFood = {
  fdcId?: number;
  description?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: Array<{
    nutrientId?: number;
    nutrientName?: string;
    unitName?: string;
    value?: number;
  }>;
};

export type SupabaseFoodRow = {
  id: string;
  canonical_name: string;
  display_name_tr: string;
  brand?: string | null;
  barcode?: string | null;
  source: FoodSource;
  source_id?: string | null;
  source_url?: string | null;
  image_url?: string | null;
  category?: string | null;
  calories_per_100g: number | string;
  protein_per_100g: number | string;
  carbs_per_100g: number | string;
  fat_per_100g: number | string;
  fiber_per_100g: number | string;
  serving_size_grams?: number | string | null;
  serving_label?: string | null;
  verified?: boolean | null;
  data_quality?: FoodDataQuality | null;
  aliases?: string[] | null;
  match_score?: number | string | null;
  personalized?: boolean | null;
};

function finiteNonNegative(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseServingGrams(value: string | undefined) {
  const match = value?.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*(?:g|gr|gram)\b/i);
  const grams = match ? Number(match[1]) : null;
  return grams && Number.isFinite(grams) && grams > 0 && grams <= 5_000 ? grams : null;
}

export function mapOpenFoodFactsProduct(product: OpenFoodFactsProduct): FoodNutrition | null {
  const nutrients = product.nutriments || {};
  const name = String(product.product_name_tr || product.product_name || "").trim();
  const calories = finiteNonNegative(nutrients["energy-kcal_100g"]);
  if (!name || calories <= 0) return null;
  const brands = Array.isArray(product.brands) ? product.brands : product.brands?.split(",");
  return {
    id: `off-${product.code || name.toLocaleLowerCase("tr-TR")}`,
    name,
    brand: brands?.map((brand) => brand.trim()).filter(Boolean).join(", ") || null,
    barcode: product.code || null,
    imageUrl: product.image_front_url || null,
    source: "open_food_facts",
    sourceId: product.code || null,
    servingSizeGrams: parseServingGrams(product.serving_size),
    servingLabel: product.serving_size || null,
    caloriesPer100g: calories,
    proteinPer100g: finiteNonNegative(nutrients.proteins_100g),
    carbohydratesPer100g: finiteNonNegative(nutrients.carbohydrates_100g),
    fatPer100g: finiteNonNegative(nutrients.fat_100g),
    fiberPer100g: finiteNonNegative(nutrients.fiber_100g),
    verified: true,
    dataQuality: "provider",
  };
}

const USDA_NUTRIENTS = {
  calories: [1008, "Energy"],
  protein: [1003, "Protein"],
  carbohydrates: [1005, "Carbohydrate, by difference"],
  fat: [1004, "Total lipid (fat)"],
  fiber: [1079, "Fiber, total dietary"],
} as const;

function usdaNutrient(food: UsdaFood, key: keyof typeof USDA_NUTRIENTS) {
  const [id, name] = USDA_NUTRIENTS[key];
  const nutrient = food.foodNutrients?.find((item) => item.nutrientId === id || item.nutrientName === name);
  return finiteNonNegative(nutrient?.value);
}

export function mapUsdaFood(food: UsdaFood): FoodNutrition | null {
  const name = String(food.description || "").trim();
  const calories = usdaNutrient(food, "calories");
  if (!name || calories <= 0) return null;
  const servingSize = finiteNonNegative(food.servingSize);
  return {
    id: `usda-${food.fdcId || name.toLowerCase()}`,
    name,
    brand: food.brandName?.trim() || null,
    barcode: null,
    imageUrl: null,
    source: "usda",
    sourceId: food.fdcId ? String(food.fdcId) : null,
    servingSizeGrams: food.servingSizeUnit?.toLowerCase() === "g" && servingSize > 0 ? servingSize : null,
    servingLabel: servingSize > 0 && food.servingSizeUnit ? `${servingSize} ${food.servingSizeUnit}` : null,
    caloriesPer100g: calories,
    proteinPer100g: usdaNutrient(food, "protein"),
    carbohydratesPer100g: usdaNutrient(food, "carbohydrates"),
    fatPer100g: usdaNutrient(food, "fat"),
    fiberPer100g: usdaNutrient(food, "fiber"),
    verified: true,
    dataQuality: "provider",
  };
}

export function mapSupabaseFood(row: SupabaseFoodRow): FoodNutrition | null {
  const name = String(row.display_name_tr || row.canonical_name || "").trim();
  const calories = finiteNonNegative(row.calories_per_100g);
  if (!name || calories <= 0) return null;
  const serving = finiteNonNegative(row.serving_size_grams);
  const dataQuality = row.data_quality || (row.verified ? "verified" : "provider");
  return {
    id: row.id,
    name,
    brand: row.brand?.trim() || null,
    barcode: row.barcode?.trim() || null,
    imageUrl: row.image_url || null,
    source: FOOD_SOURCES.includes(row.source) ? row.source : "admin",
    sourceId: row.source_id || null,
    servingSizeGrams: serving > 0 ? serving : null,
    servingLabel: row.serving_label || null,
    caloriesPer100g: calories,
    proteinPer100g: finiteNonNegative(row.protein_per_100g),
    carbohydratesPer100g: finiteNonNegative(row.carbs_per_100g),
    fatPer100g: finiteNonNegative(row.fat_per_100g),
    fiberPer100g: finiteNonNegative(row.fiber_per_100g),
    verified: dataQuality === "verified" || dataQuality === "provider",
    dataQuality,
    category: row.category || null,
    aliases: row.aliases || [],
    matchScore: finiteNonNegative(row.match_score),
    personalized: Boolean(row.personalized),
  };
}

export function toLegacyNutrition(food: FoodNutrition): LegacyFoodNutrition {
  return {
    calories: food.caloriesPer100g,
    protein: food.proteinPer100g,
    carbs: food.carbohydratesPer100g,
    fat: food.fatPer100g,
    fiber: food.fiberPer100g,
    micros: {},
  };
}
