import { mergeFoodResults, searchLocalFoods, type FoodMicronutrients, type FoodNutrition, type FoodSearchResult } from "@/lib/food-search";

export const runtime = "edge";

type OpenFoodFactsProduct = {
  code?: string;
  product_name?: string;
  product_name_tr?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: Record<string, unknown>;
};

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function milligrams(nutrients: Record<string, unknown>, name: string) {
  const value = numeric(nutrients[`${name}_100g`]);
  const unit = String(nutrients[`${name}_unit`] || "g").toLowerCase();
  if (!value) return 0;
  if (unit === "mg") return value;
  if (unit === "µg" || unit === "ug") return value / 1_000;
  return value * 1_000;
}

function servingGrams(value: string | undefined) {
  const match = value?.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*g\b/i);
  const grams = match ? Number(match[1]) : 100;
  return Number.isFinite(grams) && grams > 0 && grams <= 2_000 ? grams : 100;
}

function toFood(product: OpenFoodFactsProduct): FoodSearchResult | null {
  const nutrients = product.nutriments || {};
  const calories = Math.round(numeric(nutrients["energy-kcal_100g"]));
  const name = product.product_name_tr || product.product_name;
  if (!name || !calories) return null;
  const micros: FoodMicronutrients = {};
  const sodium = milligrams(nutrients, "sodium");
  const calcium = milligrams(nutrients, "calcium");
  const iron = milligrams(nutrients, "iron");
  const potassium = milligrams(nutrients, "potassium");
  const vitaminC = milligrams(nutrients, "vitamin-c");
  if (sodium) micros.sodiumMg = sodium;
  if (calcium) micros.calciumMg = calcium;
  if (iron) micros.ironMg = iron;
  if (potassium) micros.potassiumMg = potassium;
  if (vitaminC) micros.vitaminCMg = vitaminC;
  const nutritionPer100g: FoodNutrition = {
    calories,
    protein: numeric(nutrients.proteins_100g),
    carbs: numeric(nutrients.carbohydrates_100g),
    fat: numeric(nutrients.fat_100g),
    fiber: numeric(nutrients.fiber_100g),
    micros,
  };
  return { id: `off-${product.code || name}`, name, brand: product.brands || undefined, barcode: product.code || undefined, servingGrams: servingGrams(product.serving_size), nutritionPer100g, source: "Open Food Facts" };
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2) return Response.json({ error: "En az iki karakterle arama yapın." }, { status: 400 });
  if (query.length > 80) return Response.json({ error: "Arama metni çok uzun." }, { status: 400 });

  const local = searchLocalFoods(query);
  try {
    const params = new URLSearchParams({
      search_terms: query,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: "8",
      fields: "code,product_name,product_name_tr,brands,serving_size,nutriments",
      lc: "tr",
    });
    const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, {
      headers: { "User-Agent": "fit.ai nutrition tracker/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("catalog unavailable");
    const payload = await response.json() as { products?: OpenFoodFactsProduct[] };
    const remote = (payload.products || []).map(toFood).filter((food): food is FoodSearchResult => Boolean(food));
    return Response.json({ results: mergeFoodResults(local, remote), source: "Open Food Facts" });
  } catch {
    if (local.length) return Response.json({ results: local, source: "FİT.AI temel besin listesi", notice: "Ürün kataloğuna ulaşılamadı; temel besin listesi gösteriliyor." });
    return Response.json({ results: [], error: "Ürün kataloğuna şu an erişilemiyor. Besinini manuel olarak ekleyebilirsin." }, { status: 503 });
  }
}
