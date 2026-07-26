import { localNutritionAdvice, type NutritionAdviceInput } from "@/lib/nutrition-advice";
import { authenticateRequest } from "@/lib/api-auth";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { generateAiText, hasAiProvider } from "@/lib/ai-provider";

export const runtime = "edge";

function bounded(value: unknown, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(maximum, parsed)) : 0;
}

function sanitizeInput(value: unknown): NutritionAdviceInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const totals = input.totals && typeof input.totals === "object" ? input.totals as Record<string, unknown> : {};
  const meals = Array.isArray(input.meals) ? input.meals.slice(0, 20).flatMap((meal) => {
    if (!meal || typeof meal !== "object") return [];
    const item = meal as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 100) : "";
    if (!name) return [];
    return [{ name, meal: typeof item.meal === "string" ? item.meal.slice(0, 30) : "Öğün", calories: bounded(item.calories, 5_000), protein: bounded(item.protein, 500), carbs: bounded(item.carbs, 1_000), fat: bounded(item.fat, 500) }];
  }) : [];
  return {
    calorieTarget: bounded(input.calorieTarget, 10_000),
    proteinTarget: bounded(input.proteinTarget, 500),
    carbsTarget: bounded(input.carbsTarget, 1_000),
    fatTarget: bounded(input.fatTarget, 500),
    totals: { calories: bounded(totals.calories, 20_000), protein: bounded(totals.protein, 1_000), carbs: bounded(totals.carbs, 2_000), fat: bounded(totals.fat, 1_000) },
    meals,
  };
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const rateLimitResult = rateLimit(`nutrition-advice:${auth.user.id}`, 15, 60000);
  if (!rateLimitResult.ok) return tooManyRequests(rateLimitResult.retryAfterSeconds);

  const body = await request.json().catch(() => null) as { locale?: unknown } | null;
  const locale = body && body.locale === "en" ? "en" : "tr";
  const input = sanitizeInput(body);
  if (!input || !input.calorieTarget) return Response.json({ error: "Beslenme özeti geçersiz" }, { status: 400 });
  const fallback = localNutritionAdvice(input, locale);
  if (!hasAiProvider() || !input.meals.length) return Response.json({ advice: fallback, source: "fallback" });

  const languageInstruction = locale === "en" ? "in English" : "Türkçe";
  const prompt = `Aşağıdaki anonim günlük beslenme özetine göre ${languageInstruction}, tıbbi olmayan ve tek paragraf halinde en fazla 65 kelimelik bir sonraki öğün önerisi yaz. Kesin sağlık iddiası üretme. Eksik makrolara odaklan ve 2-4 yaygın besin örneği ver. Kalori hedefini aşmayı teşvik etme.\n${JSON.stringify(input)}`;
  try {
    const advice = await generateAiText({ prompt, temperature: 0.3, maxOutputTokens: 180, abortSignal: AbortSignal.timeout(15_000) });
    if (advice.trim()) return Response.json({ advice: advice.trim(), source: "ai" });
  } catch {
    // Yerel yedeğe düşülür.
  }
  return Response.json({ advice: fallback, source: "fallback" });
}
