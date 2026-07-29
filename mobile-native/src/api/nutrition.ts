export type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type FoodSearchResult = {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  servingGrams?: number;
  nutritionPer100g: Nutrition | null;
  nutritionPerServing?: Nutrition | null;
  portionLabel?: string;
  variantSummary?: string;
  canonicalFamily?: string;
  needsReview?: boolean;
  personalized?: boolean;
};

type ClientOptions = {
  baseUrl: string;
  accessToken: string;
};

async function api<T>(path: string, options: ClientOptions, init?: RequestInit): Promise<T> {
  const response = await fetch(`${options.baseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "İstek tamamlanamadı.");
  return payload as T;
}

export async function searchFoods(query: string, options: ClientOptions) {
  const params = new URLSearchParams({ q: query, locale: "tr", limit: "20" });
  const payload = await api<{ results: FoodSearchResult[] }>(`/api/nutrition/search?${params}`, options);
  return payload.results;
}

export async function recordFoodSelection(
  food: FoodSearchResult,
  query: string,
  portionGrams: number,
  mealType: string,
  options: ClientOptions,
) {
  await api("/api/nutrition/selections", options, {
    method: "POST",
    body: JSON.stringify({ foodId: food.id, query, grams: portionGrams, mealType }),
  });
}
