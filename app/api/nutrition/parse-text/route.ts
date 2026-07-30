import { authenticateRequest } from "../../../../lib/api-auth.ts";
import { estimateAiTextNutrition } from "../../../../lib/ai-nutrition-estimator.ts";
import { hasAiProvider } from "../../../../lib/ai-provider.ts";
import { containsPromptInjection } from "../../../../lib/nutrition-parser.ts";
import { rateLimit, tooManyRequests } from "../../../../lib/rate-limit.ts";
import { checkAndConsumeUsage, usageLimitExceeded } from "../../../../lib/usage-limits.ts";

export const runtime = "edge";

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const limited = rateLimit(`nutrition-estimate:${auth.user.id}`, 15, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  const body = await request.json().catch(() => ({})) as { query?: unknown; grams?: unknown };
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const grams = Number(body.grams);
  if (query.length < 2 || query.length > 160) {
    return Response.json({ error: "Yemek adı 2–160 karakter arasında olmalı." }, { status: 400 });
  }
  if (!Number.isFinite(grams) || grams <= 0 || grams > 5000) {
    return Response.json({ error: "Gramaj 1–5000 gram arasında olmalı." }, { status: 400 });
  }
  if (!hasAiProvider()) {
    return Response.json({ error: "AI besin hesaplama servisi yapılandırılmamış." }, { status: 503 });
  }

  const usage = await checkAndConsumeUsage(request, "text_nutrition");
  if ("error" in usage) return usage.error;
  if (!usage.allowed) return usageLimitExceeded("text_nutrition", usage.used, usage.limit);

  try {
    const item = await estimateAiTextNutrition({ foodName: query, grams, timeoutMs: 20_000 });
    if (!item) return Response.json({ error: "Besin değerleri güvenle hesaplanamadı; tekrar deneyebilirsin." }, { status: 422 });
    const warnings = [
      "Değerler tarife ve markaya göre değişebilen yapay zekâ tahminidir.",
      ...(containsPromptInjection(query) ? ["Yemek adındaki talimat benzeri içerik yok sayıldı."] : []),
    ];
    return Response.json({
      items: [{
        query: item.name,
        estimatedGrams: item.grams,
        confidence: item.confidence,
        needsConfirmation: item.confidence < 0.75,
        nutrition: {
          calories: item.calories,
          protein: item.protein,
          carbohydrates: item.carbohydrates,
          fat: item.fat,
          fiber: item.fiber,
        },
      }],
      totals: {
        calories: item.calories,
        protein: item.protein,
        carbohydrates: item.carbohydrates,
        fat: item.fat,
        fiber: item.fiber,
      },
      warnings,
      confidence: item.confidence,
      isEstimated: true,
      usage: { used: usage.used, limit: usage.limit },
    });
  } catch (error) {
    console.error("[nutrition-estimate] AI request failed", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "AI besin hesaplaması zamanında tamamlanamadı; tekrar deneyebilirsin." }, { status: 502 });
  }
}
