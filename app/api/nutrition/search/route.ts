import { mergeFoodResults, searchLocalFoods } from "@/lib/food-search";
import { cacheProviderFood, foodToSearchResult, searchStoredFoods, searchUsdaFoods } from "@/lib/nutrition-data";
import { authenticateRequest } from "@/lib/api-auth";
import { searchStoredRecipes } from "@/lib/recipe-data";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "edge";

const responseHeaders = { "Cache-Control": "private, max-age=300" };

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const limited = rateLimit(`food-search:${auth.user.id}`, 40, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2) return Response.json({ error: "En az iki karakterle arama yapın." }, { status: 400 });
  if (query.length > 80) return Response.json({ error: "Arama metni çok uzun." }, { status: 400 });

  const [storedFoods, recipes] = await Promise.all([
    searchStoredFoods(request, query, 15),
    searchStoredRecipes(request, query, 15),
  ]);
  const stored = storedFoods.map(foodToSearchResult);
  const local = searchLocalFoods(query, 15);
  const firstPass = mergeFoodResults(recipes, mergeFoodResults(stored, local, 20), 20);

  try {
    // Open Food Facts genel yemek/tarif aramasında kullanılmaz. Yalnızca
    // barkod uç noktası paketli ürünler için sağlayıcıya gider.
    const usda = await searchUsdaFoods(query, 10);
    await Promise.all(usda.slice(0, 5).map((food) => cacheProviderFood(food, null)));
    const remote = usda.map(foodToSearchResult);
    return Response.json(
      { results: mergeFoodResults(firstPass, remote, 20) },
      { headers: responseHeaders },
    );
  } catch {
    return Response.json({
      results: firstPass,
      notice: firstPass.length
        ? "Canlı ürün kataloglarına ulaşılamadı; yerel besinler gösteriliyor."
        : "Besin kataloglarına şu an erişilemiyor. Besinini kendi değerlerinle ekleyebilirsin.",
    }, { headers: responseHeaders });
  }
}
