import { authenticateRequest } from "@/lib/api-auth";
import { searchFoodCatalog } from "@/lib/nutrition-data";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "edge";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const limited = rateLimit(`food-search:${auth.user.id}`, 40, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  const searchParams = new URL(request.url).searchParams;
  const query = searchParams.get("q")?.trim() || "";
  const locale = searchParams.get("locale") === "en" ? "en" : "tr";
  const resultLimit = Math.min(20, Math.max(1, Number(searchParams.get("limit")) || 12));
  if (query.length < 2 || query.length > 80) {
    return Response.json({ error: "Arama metni 2–80 karakter olmalıdır." }, { status: 400 });
  }

  try {
    const search = await searchFoodCatalog(request, query, resultLimit, locale);
    return Response.json({
      results: search.results,
      meta: {
        query,
        cacheHit: search.cacheHit,
        providerQueried: search.providerQueried,
        personalized: search.results.some((result) => result.personalized),
      },
    }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    console.error("[food-search] failed", error instanceof Error ? error.name : "unknown");
    return Response.json({
      results: [],
      error: "Besin araması şu an tamamlanamadı.",
      retryable: true,
    }, { status: 503 });
  }
}
