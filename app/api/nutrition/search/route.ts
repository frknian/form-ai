import {
  mergeFoodResults,
  normalizeFoodSearchText,
  openFoodFactsHitToFood,
  searchLocalFoods,
  type OpenFoodFactsSearchHit,
} from "@/lib/food-search";
import { authenticateRequest } from "@/lib/api-auth";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "edge";

// Uç nokta kimlik doğrulaması gerektirdiği için paylaşımlı (CDN) önbelleğe alınmaz.
const responseHeaders = {
  "Cache-Control": "private, max-age=300",
};

function isExactLocalMatch(query: string, name: string, brand?: string) {
  const normalizedQuery = normalizeFoodSearchText(query);
  return normalizedQuery === normalizeFoodSearchText(name)
    || normalizedQuery === normalizeFoodSearchText(`${brand || ""} ${name}`);
}

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const rateLimitResult = rateLimit(`food-search:${auth.user.id}`, 40, 60000);
  if (!rateLimitResult.ok) return tooManyRequests(rateLimitResult.retryAfterSeconds);

  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2) return Response.json({ error: "En az iki karakterle arama yapın." }, { status: 400 });
  if (query.length > 80) return Response.json({ error: "Arama metni çok uzun." }, { status: 400 });

  const local = searchLocalFoods(query, 8);
  if (local.some((food) => isExactLocalMatch(query, food.name, food.brand))) {
    return Response.json({ results: local, source: "FİT.AI temel besin listesi" }, { headers: responseHeaders });
  }

  try {
    const response = await fetch("https://search.openfoodfacts.org/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "fit.ai nutrition tracker/1.0",
      },
      body: JSON.stringify({
        q: query,
        page: 1,
        page_size: 8,
        langs: ["tr", "en"],
        boost_phrase: true,
        fields: ["code", "product_name", "product_name_tr", "brands", "serving_size", "nutriments"],
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("catalog unavailable");
    const payload = await response.json() as { hits?: OpenFoodFactsSearchHit[] };
    const remote = (payload.hits || [])
      .map(openFoodFactsHitToFood)
      .filter((food) => food !== null);
    return Response.json(
      { results: mergeFoodResults(local, remote), source: "Open Food Facts" },
      { headers: responseHeaders },
    );
  } catch {
    return Response.json({
      results: local,
      source: "FİT.AI temel besin listesi",
      notice: local.length
        ? "Canlı ürün kataloğuna ulaşılamadı; doğrulanmış temel liste gösteriliyor."
        : "Canlı ürün kataloğuna şu an erişilemiyor. Besinini kendi değerlerinle ekleyebilirsin.",
    }, { headers: responseHeaders });
  }
}
