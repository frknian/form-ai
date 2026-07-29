import { authenticateRequest } from "../../../../lib/api-auth.ts";
import { estimateAiNutrition } from "../../../../lib/ai-nutrition-estimator.ts";
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

  const usage = await checkAndConsumeUsage(request, "chat");
  if ("error" in usage) return usage.error;
  if (!usage.allowed) return usageLimitExceeded("chat", usage.used, usage.limit);

  try {
    const result = await estimateAiNutrition({
      prompt: `<untrusted_food_name>${query}</untrusted_food_name>\nKullanıcının tarttığı toplam yenebilir porsiyon: ${grams} gram. Tek bir toplam yemek olarak hesapla ve items dizisinde bir item döndür. item.grams tam olarak ${grams} olmalı.`,
      timeoutMs: 20_000,
    });
    if (!result) return Response.json({ error: "Besin değerleri güvenle hesaplanamadı; alanları elle düzenleyebilirsin." }, { status: 422 });
    if (containsPromptInjection(query)) result.warnings.unshift("Yemek adındaki talimat benzeri içerik yok sayıldı.");
    const item = result.items[0];
    return Response.json({
      items: result.items.map((entry) => ({
        query: entry.name,
        estimatedGrams: entry.grams,
        confidence: entry.confidence,
        needsConfirmation: entry.confidence < 0.75,
        nutrition: {
          calories: entry.calories,
          protein: entry.protein,
          carbohydrates: entry.carbohydrates,
          fat: entry.fat,
          fiber: entry.fiber,
        },
        assumptions: entry.assumptions,
      })),
      totals: result.totals,
      warnings: result.warnings,
      confidence: item.confidence,
      isEstimated: true,
      usage: { used: usage.used, limit: usage.limit },
    });
  } catch (error) {
    console.error("[nutrition-estimate] AI request failed", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "AI besin hesaplaması zamanında tamamlanamadı; tekrar deneyebilirsin." }, { status: 502 });
  }
}
