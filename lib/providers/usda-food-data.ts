import type { IngredientNutritionBasis } from "../recipe-nutrition.ts";
import type { UsdaFood } from "../nutrition-model.ts";

const USDA_NUTRIENTS = {
  calories: [1008, "Energy"],
  protein: [1003, "Protein"],
  carbohydrates: [1005, "Carbohydrate, by difference"],
  fat: [1004, "Total lipid (fat)"],
  fiber: [1079, "Fiber, total dietary"],
} as const;

function apiKey() {
  return process.env.USDA_FDC_API_KEY?.trim() || null;
}

function nutrient(food: UsdaFood, key: keyof typeof USDA_NUTRIENTS) {
  const [id, name] = USDA_NUTRIENTS[key];
  const match = food.foodNutrients?.find((item) => item.nutrientId === id || item.nutrientName === name);
  const value = Number(match?.value);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

async function usdaRequest(path: string, init?: RequestInit) {
  const key = apiKey();
  if (!key) return null;
  const response = await fetch(`https://api.nal.usda.gov/fdc/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": key,
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`USDA FoodData Central isteği başarısız (${response.status}).`);
  return response;
}

export function isUsdaFoodDataConfigured() {
  return Boolean(apiKey());
}

export async function searchUsdaFoodData(query: string, limit = 10): Promise<UsdaFood[]> {
  const normalized = query.trim();
  if (!normalized || normalized.length > 80 || !apiKey()) return [];
  const response = await usdaRequest("/foods/search", {
    method: "POST",
    body: JSON.stringify({
      query: normalized,
      pageSize: Math.min(20, Math.max(1, limit)),
      dataType: ["Foundation", "SR Legacy"],
    }),
  });
  if (!response) return [];
  const payload = await response.json() as { foods?: UsdaFood[] };
  return Array.isArray(payload.foods) ? payload.foods : [];
}

export async function getUsdaFoodData(fdcId: number): Promise<UsdaFood | null> {
  if (!Number.isInteger(fdcId) || fdcId <= 0 || !apiKey()) return null;
  const response = await usdaRequest(`/food/${fdcId}`);
  return response ? response.json() as Promise<UsdaFood> : null;
}

export function usdaFoodToIngredientBasis(food: UsdaFood): IngredientNutritionBasis | null {
  if (!food.fdcId || !food.description?.trim()) return null;
  const protein = nutrient(food, "protein");
  const carbohydrates = nutrient(food, "carbohydrates");
  const fat = nutrient(food, "fat");
  const fiber = nutrient(food, "fiber");
  if ([protein, carbohydrates, fat, fiber].some((value) => value === null)) return null;
  return {
    caloriesPer100g: nutrient(food, "calories"),
    proteinPer100g: protein,
    carbohydratesPer100g: carbohydrates,
    fatPer100g: fat,
    fiberPer100g: fiber,
    source: "usda_fdc",
    sourceId: String(food.fdcId),
    confidence: "high",
  };
}
