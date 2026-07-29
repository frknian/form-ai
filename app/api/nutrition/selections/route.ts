import { authenticateRequest } from "@/lib/api-auth";
import { nutritionUserClient } from "@/lib/nutrition-log";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "edge";

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const limited = rateLimit(`food-selection:${auth.user.id}`, 60, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const foodId = typeof body?.foodId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.foodId)
    ? body.foodId
    : "";
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const grams = body?.grams === null || body?.grams === undefined ? null : Number(body.grams);
  const mealType = typeof body?.mealType === "string" ? body.mealType.trim().slice(0, 40) : null;
  if (!foodId || query.length < 2 || query.length > 80 || (grams !== null && (!Number.isFinite(grams) || grams < 1 || grams > 5_000))) {
    return Response.json({ error: "Besin seçimi geçersiz." }, { status: 400 });
  }

  const client = nutritionUserClient(request);
  if (!client) return Response.json({ error: "Besin seçimi kaydedilemedi." }, { status: 503 });
  const { error } = await client.rpc("record_food_selection", {
    p_food_id: foodId,
    p_query: query,
    p_portion_grams: grams,
    p_meal_type: mealType,
  });
  if (error) return Response.json({ error: "Besin seçimi kaydedilemedi." }, { status: 500 });
  return Response.json({ saved: true }, { status: 201 });
}
