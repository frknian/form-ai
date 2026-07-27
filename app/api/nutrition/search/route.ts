import { mergeFoodResults, normalizeFoodSearchText, searchLocalFoods, type FoodSearchResult } from "@/lib/food-search";
import { cacheProviderFood, foodToSearchResult, searchOpenFoodFacts, searchStoredFoods, searchUsdaFoods } from "@/lib/nutrition-data";
import { authenticateRequest } from "@/lib/api-auth";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "edge";

const responseHeaders = { "Cache-Control": "private, max-age=300" };

function exact(query: string, food: FoodSearchResult) {
  const normalized = normalizeFoodSearchText(query);
  return normalized === normalizeFoodSearchText(food.name)
    || normalized === normalizeFoodSearchText(`${food.brand || ""} ${food.name}`);
}

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const limited = rateLimit(`food-search:${auth.user.id}`, 40, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2) return Response.json({ error: "En az iki karakterle arama yapın." }, { status: 400 });
  if (query.length > 80) return Response.json({ error: "Arama metni çok uzun." }, { status: 400 });

  const stored = (await searchStoredFoods(request, query, 10)).map(foodToSearchResult);
  const local = searchLocalFoods(query, 10);
  const firstPass = mergeFoodResults(stored, local, 10);
  if (firstPass.some((food) => exact(query, food))) {
    return Response.json({ results: firstPass, source: firstPass[0]?.source }, { headers: responseHeaders });
  }

  try {
    const [off, usda] = await Promise.all([
      searchOpenFoodFacts(query, 8),
      searchUsdaFoods(query, 5),
    ]);
    await Promise.all([...off, ...usda].slice(0, 5).map((food) => cacheProviderFood(food, null)));
    const remote = [...off, ...usda].map(foodToSearchResult);
    return Response.json(
      { results: mergeFoodResults(firstPass, remote, 10), source: remote[0]?.source || firstPass[0]?.source },
      { headers: responseHeaders },
    );
  } catch {
    return Response.json({
      results: firstPass,
      source: firstPass[0]?.source,
      notice: firstPass.length
        ? "Canlı ürün kataloglarına ulaşılamadı; yerel besinler gösteriliyor."
        : "Besin kataloglarına şu an erişilemiyor. Besinini kendi değerlerinle ekleyebilirsin.",
    }, { headers: responseHeaders });
  }
}
