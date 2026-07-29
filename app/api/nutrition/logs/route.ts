import { authenticateRequest } from "@/lib/api-auth";
import { nutritionUserClient, toFoodEntryRow, validateNutritionLogInput } from "@/lib/nutrition-log";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "edge";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const limited = rateLimit(`nutrition-logs-read:${auth.user.id}`, 60, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  const client = nutritionUserClient(request);
  if (!client) return Response.json({ error: "Beslenme günlüğü yapılandırılmamış." }, { status: 503 });
  const date = new URL(request.url).searchParams.get("date");
  let query = client.from("food_entries").select("*").eq("user_id", auth.user.id).order("consumed_at", { ascending: false }).limit(100);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) query = query.eq("logged_date", date);
  const { data, error } = await query;
  if (error) return Response.json({ error: "Beslenme günlüğü yüklenemedi." }, { status: 500 });
  return Response.json({ logs: data || [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const limited = rateLimit(`nutrition-logs-create:${auth.user.id}`, 30, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  const body = await request.json().catch(() => null);
  const input = validateNutritionLogInput(body);
  if (!input) return Response.json({ error: "Beslenme kaydı geçersiz." }, { status: 400 });
  const client = nutritionUserClient(request);
  if (!client) return Response.json({ error: "Beslenme günlüğü yapılandırılmamış." }, { status: 503 });
  const id = crypto.randomUUID();
  const consumedAt = new Date().toISOString();
  const { data, error } = await client.from("food_entries").insert({
    id,
    user_id: auth.user.id,
    consumed_at: consumedAt,
    ...toFoodEntryRow(input),
  }).select("*").single();
  if (error) {
    console.error("[nutrition-logs] insert failed", error.code);
    return Response.json({ error: "Beslenme kaydı kaydedilemedi." }, { status: 500 });
  }
  return Response.json({ log: data }, { status: 201 });
}
