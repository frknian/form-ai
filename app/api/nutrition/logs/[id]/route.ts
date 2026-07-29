import { authenticateRequest } from "@/lib/api-auth";
import { nutritionUserClient, toFoodEntryRow, validateNutritionLogInput } from "@/lib/nutrition-log";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "edge";

function validId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const limited = rateLimit(`nutrition-logs-update:${auth.user.id}`, 30, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  const { id } = await params;
  if (!validId(id)) return Response.json({ error: "Geçersiz kayıt kimliği." }, { status: 400 });
  const input = validateNutritionLogInput(await request.json().catch(() => null), true);
  if (!input || Object.keys(input).length === 0) return Response.json({ error: "Güncellenecek geçerli alan bulunamadı." }, { status: 400 });
  const client = nutritionUserClient(request);
  if (!client) return Response.json({ error: "Beslenme günlüğü yapılandırılmamış." }, { status: 503 });
  const { data, error } = await client.from("food_entries")
    .update(toFoodEntryRow(input))
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("*")
    .maybeSingle();
  if (error) return Response.json({ error: "Beslenme kaydı güncellenemedi." }, { status: 500 });
  if (!data) return Response.json({ error: "Beslenme kaydı bulunamadı." }, { status: 404 });
  return Response.json({ log: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const limited = rateLimit(`nutrition-logs-delete:${auth.user.id}`, 30, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);
  const { id } = await params;
  if (!validId(id)) return Response.json({ error: "Geçersiz kayıt kimliği." }, { status: 400 });
  const client = nutritionUserClient(request);
  if (!client) return Response.json({ error: "Beslenme günlüğü yapılandırılmamış." }, { status: 503 });
  const { data, error } = await client.from("food_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id")
    .maybeSingle();
  if (error) return Response.json({ error: "Beslenme kaydı silinemedi." }, { status: 500 });
  if (!data) return Response.json({ error: "Beslenme kaydı bulunamadı." }, { status: 404 });
  return new Response(null, { status: 204 });
}
