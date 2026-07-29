import type { UsdaFood } from "../nutrition-model.ts";

function apiKey() {
  return process.env.USDA_FDC_API_KEY?.trim() || null;
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
