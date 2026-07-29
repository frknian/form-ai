export type FoodMicronutrients = {
  sugarG?: number;
  sodiumMg?: number;
  calciumMg?: number;
  ironMg?: number;
  potassiumMg?: number;
  vitaminCMg?: number;
};

export type FoodNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  micros: FoodMicronutrients;
};

export type FoodSearchResult = {
  id: string;
  name: string;
  kind?: "food" | "recipe";
  brand?: string;
  aliases?: string[];
  barcode?: string;
  servingGrams?: number;
  portionLabel?: string;
  nutritionPer100g: FoodNutrition | null;
  nutritionPerServing?: FoodNutrition | null;
  recipeSlug?: string;
  canonicalFamily?: string;
  variantSummary?: string;
  allergens?: string[];
  confidence?: "low" | "medium" | "high";
  needsReview?: boolean;
  source: "Open Food Facts" | "USDA FoodData Central" | "FİT.AI besin veritabanı";
  verified?: boolean;
  dataQuality?: "verified" | "provider" | "user_entered";
  imageUrl?: string;
  category?: string;
  matchScore?: number;
  personalized?: boolean;
  cacheHit?: boolean;
};

export type OpenFoodFactsSearchHit = {
  code?: string;
  product_name?: string;
  product_name_tr?: string;
  brands?: string[] | string;
  serving_size?: string;
  nutriments?: Record<string, unknown>;
};

export const emptyFoodNutrition = (): FoodNutrition => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  micros: {},
});

function rounded(value: number, digits = 1) {
  const multiplier = 10 ** digits;
  return Math.round(Math.max(0, Number.isFinite(value) ? value : 0) * multiplier) / multiplier;
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function micronutrientMilligrams(nutrients: Record<string, unknown>, name: string) {
  const amount = numeric(nutrients[`${name}_100g`]);
  const unit = String(nutrients[`${name}_unit`] || "g").toLowerCase();
  if (!amount) return 0;
  if (unit === "mg") return amount;
  if (unit === "µg" || unit === "ug") return amount / 1_000;
  return amount * 1_000;
}

function parseServingGrams(value: string | undefined) {
  const match = value?.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*g\b/i);
  const grams = match ? Number(match[1]) : 100;
  return Number.isFinite(grams) && grams > 0 && grams <= 2_000 ? grams : 100;
}

export function normalizeFoodSearchText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function openFoodFactsHitToFood(hit: OpenFoodFactsSearchHit): FoodSearchResult | null {
  const nutrients = hit.nutriments || {};
  const name = hit.product_name_tr || hit.product_name;
  const calories = Math.round(numeric(nutrients["energy-kcal_100g"]));
  if (!name || !calories) return null;

  const micros: FoodMicronutrients = {};
  const sugar = numeric(nutrients.sugars_100g);
  const sodium = micronutrientMilligrams(nutrients, "sodium");
  const calcium = micronutrientMilligrams(nutrients, "calcium");
  const iron = micronutrientMilligrams(nutrients, "iron");
  const potassium = micronutrientMilligrams(nutrients, "potassium");
  const vitaminC = micronutrientMilligrams(nutrients, "vitamin-c");
  if (sugar) micros.sugarG = rounded(sugar);
  if (sodium) micros.sodiumMg = rounded(sodium);
  if (calcium) micros.calciumMg = rounded(calcium);
  if (iron) micros.ironMg = rounded(iron);
  if (potassium) micros.potassiumMg = rounded(potassium);
  if (vitaminC) micros.vitaminCMg = rounded(vitaminC);

  const brands = Array.isArray(hit.brands) ? hit.brands : hit.brands?.split(",");
  return {
    id: `off-${hit.code || normalizeFoodSearchText(name)}`,
    name,
    brand: brands?.map((brand) => brand.trim()).filter(Boolean).join(", ") || undefined,
    barcode: hit.code || undefined,
    servingGrams: parseServingGrams(hit.serving_size),
    nutritionPer100g: {
      calories,
      protein: rounded(numeric(nutrients.proteins_100g)),
      carbs: rounded(numeric(nutrients.carbohydrates_100g)),
      fat: rounded(numeric(nutrients.fat_100g)),
      fiber: rounded(numeric(nutrients.fiber_100g)),
      micros,
    },
    source: "Open Food Facts",
    verified: true,
    dataQuality: "provider",
  };
}

export function scaleFoodNutrition(nutrition: FoodNutrition, grams: number): FoodNutrition {
  const factor = Math.max(0, Number.isFinite(grams) ? grams : 0) / 100;
  return {
    calories: Math.round(nutrition.calories * factor),
    protein: rounded(nutrition.protein * factor),
    carbs: rounded(nutrition.carbs * factor),
    fat: rounded(nutrition.fat * factor),
    fiber: rounded(nutrition.fiber * factor),
    micros: Object.fromEntries(
      Object.entries(nutrition.micros).map(([key, value]) => [key, rounded((value || 0) * factor)]),
    ) as FoodMicronutrients,
  };
}

export function mergeFoodResults(primary: FoodSearchResult[], secondary: FoodSearchResult[], limit = 12) {
  const unique = new Map<string, FoodSearchResult>();
  for (const result of [...primary, ...secondary]) {
    const key = result.barcode || normalizeFoodSearchText(`${result.name} ${result.brand || ""}`);
    const existing = unique.get(key);
    const resultHasVerifiedBasis = Boolean(result.nutritionPer100g);
    const existingHasVerifiedBasis = Boolean(existing?.nutritionPer100g);
    if (!existing
      || (resultHasVerifiedBasis && !existingHasVerifiedBasis)
      || (resultHasVerifiedBasis === existingHasVerifiedBasis && result.personalized && !existing.personalized)
      || (resultHasVerifiedBasis === existingHasVerifiedBasis && (result.matchScore || 0) > (existing.matchScore || 0))) {
      unique.set(key, result);
    }
  }
  return [...unique.values()]
    .sort((left, right) => Number(Boolean(right.personalized)) - Number(Boolean(left.personalized))
      || (right.matchScore || 0) - (left.matchScore || 0))
    .slice(0, limit);
}
