import { authenticateRequest } from "@/lib/api-auth";
import { cacheProviderFood, findOpenFoodFactsBarcode, findStoredFoodByBarcode, foodToSearchResult } from "@/lib/nutrition-data";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "edge";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const limited = rateLimit(`food-barcode:${auth.user.id}`, 30, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  const code = new URL(request.url).searchParams.get("code")?.replace(/\D/g, "") || "";
  if (code.length < 8 || code.length > 14) return Response.json({ error: "Geçerli bir barkod girin." }, { status: 400 });

  const stored = await findStoredFoodByBarcode(request, code);
  if (stored) return Response.json({ ...foodToSearchResult(stored), cacheHit: true });

  try {
    const found = await findOpenFoodFactsBarcode(code);
    if (!found) return Response.json({
      error: "Ürün katalogda bulunamadı.",
      notFound: true,
      alternatives: ["manual", "search"],
    }, { status: 404 });
    await cacheProviderFood(found.food, found.raw);
    return Response.json({ ...foodToSearchResult(found.food), cacheHit: false });
  } catch {
    return Response.json({ error: "Ürün kataloğuna şu an erişilemiyor.", retryable: true }, { status: 503 });
  }
}
