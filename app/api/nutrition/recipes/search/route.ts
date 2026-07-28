import { authenticateRequest } from "@/lib/api-auth";
import { searchStoredRecipes } from "@/lib/recipe-data";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "edge";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const limited = rateLimit(`recipe-search:${auth.user.id}`, 40, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit")) || 10));
  if (query.length < 2 || query.length > 80) {
    return Response.json({ error: "Arama metni 2–80 karakter olmalıdır." }, { status: 400 });
  }
  const recipes = await searchStoredRecipes(request, query, limit);
  return Response.json({ recipes }, { headers: { "Cache-Control": "private, max-age=300" } });
}
