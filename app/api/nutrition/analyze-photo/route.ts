import { authenticateRequest } from "../../../../lib/api-auth.ts";
import { estimateAiNutrition } from "../../../../lib/ai-nutrition-estimator.ts";
import { hasAiProvider, parseImageDataUrl } from "../../../../lib/ai-provider.ts";
import { rateLimit, tooManyRequests } from "../../../../lib/rate-limit.ts";
import { checkAndConsumeUsage, usageLimitExceeded } from "../../../../lib/usage-limits.ts";

export const runtime = "edge";

const prompt = `Bu bir yemek fotoğrafı. Görseldeki yenebilir besinleri ayrı ayrı
belirle; her biri için yaklaşık gramajı ve o gramajın kalori, protein,
karbonhidrat, yağ ve lif değerlerini hesapla. Görünmeyen yağ, sos ve pişirme
yöntemi varsayımlarını assumptions alanına yaz. Fotoğraftan porsiyon kesin
ölçülemediği için uygun confidence ve Türkçe warnings üret. Tüm yemek adlarını
Türkçe yaz; İngilizce alternatif veya seçenek listesi üretme.`;

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const limited = rateLimit(`analyze-photo:${auth.user.id}`, 10, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  if (!hasAiProvider() || process.env.AI_VISION_ENABLED === "false") {
    return Response.json({ error: "Fotoğraftan öğün analizi şu an kullanılamıyor; yazarak ekleyebilirsin.", featureUnavailable: true }, { status: 503 });
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 7_500_000) return Response.json({ error: "Fotoğraf çok büyük." }, { status: 413 });
  const { photoDataUrl } = await request.json().catch(() => ({})) as { photoDataUrl?: unknown };
  if (typeof photoDataUrl !== "string") return Response.json({ error: "Geçerli bir yemek fotoğrafı gönderin." }, { status: 400 });
  const image = parseImageDataUrl(photoDataUrl);
  if (!image) return Response.json({ error: "Fotoğraf okunamadı veya çok büyük." }, { status: 400 });

  const usage = await checkAndConsumeUsage(request, "photo");
  if ("error" in usage) return usage.error;
  if (!usage.allowed) return usageLimitExceeded("photo", usage.used, usage.limit);

  try {
    const resolved = await estimateAiNutrition({
      prompt,
      image,
      timeoutMs: 45_000,
    });
    if (!resolved) return Response.json({ error: "Fotoğraf sonucu güvenle doğrulanamadı; başka bir fotoğrafla veya yazarak tekrar deneyebilirsin." }, { status: 422 });
    const totalGrams = resolved.items.reduce((sum, item) => sum + item.grams, 0);
    const confidence = resolved.items.some((item) => item.confidence < 0.55)
      ? "low"
      : resolved.items.every((item) => item.confidence >= 0.8) ? "high" : "medium";
    return Response.json({
      name: resolved.items.map((item) => item.name).join(", ").slice(0, 120) || "Fotoğraftaki öğün",
      itemNames: resolved.items.map((item) => item.name),
      grams: Math.round(totalGrams),
      calories: resolved.totals.calories,
      protein: resolved.totals.protein,
      carbs: resolved.totals.carbohydrates,
      fat: resolved.totals.fat,
      fiber: resolved.totals.fiber,
      confidence,
      isEstimated: true,
      needsManualNutrition: resolved.items.some((item) => item.confidence < 0.75),
      warnings: resolved.warnings,
      // Sınır uygulanmıyorsa limit sonsuzdur; JSON'da null'a döneceği için atlanır.
      ...(Number.isFinite(usage.limit) ? { usage: { used: usage.used, limit: usage.limit } } : {}),
    });
  } catch (error) {
    console.error("[nutrition-photo] Kimi request failed", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "Fotoğraf analizi şu an tamamlanamadı; yazarak ekleyebilirsin." }, { status: 502 });
  }
}
