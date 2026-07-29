import { jsonSchema } from "ai";
import { authenticateRequest } from "../../../../lib/api-auth.ts";
import { generatePhotoAiObject, hasPhotoAiProvider, parseImageDataUrl } from "../../../../lib/ai-provider.ts";
import { validateParsedMeal, type ParsedMeal } from "../../../../lib/nutrition-parser.ts";
import { resolveParsedMeal } from "../../../../lib/nutrition-resolver.ts";
import { rateLimit, tooManyRequests } from "../../../../lib/rate-limit.ts";
import { checkAndConsumeUsage, usageLimitExceeded } from "../../../../lib/usage-limits.ts";

export const runtime = "edge";

const schema = jsonSchema<ParsedMeal>({
  type: "object",
  properties: {
    items: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 1, maxLength: 100 },
          originalText: { type: "string", minLength: 1, maxLength: 160 },
          quantity: { type: "number", exclusiveMinimum: 0, maximum: 100 },
          unit: { type: "string", enum: ["gram", "adet", "dilim", "porsiyon", "bardak", "kaşık", "kase", "avuç", "bilinmiyor"] },
          estimatedGrams: { type: "number", exclusiveMinimum: 0, maximum: 5000 },
          preparation: { type: ["string", "null"] },
          brand: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          needsConfirmation: { type: "boolean" },
        },
        required: ["query", "originalText", "quantity", "unit", "estimatedGrams", "preparation", "brand", "confidence", "needsConfirmation"],
        additionalProperties: false,
      },
    },
    warnings: { type: "array", items: { type: "string", maxLength: 180 }, maxItems: 8 },
  },
  required: ["items", "warnings"],
  additionalProperties: false,
});

const prompt = `Bu bir yemek fotoğrafı. Görseldeki muhtemel besinleri tabaktaki bileşenleri birleştirmeden ayrı ayrı belirle ve Türkçe adlandır. Türk mutfağındaki yemek adlarını (ör. bezelye yemeği, fırın makarna, bulgur pilavı) tercih et. Her besin için yalnızca ad, yaklaşık gram, hazırlanma yöntemi ve güven bilgisi üret. Kalori veya makro değeri üretme. Fotoğrafta kesin belirlenemeyen porsiyon, sos ve yağ miktarları için needsConfirmation=true yap ve warnings alanına Türkçe uyarı ekle. originalText alanına görseldeki besinin kısa tanımını, quantity=1 ve uygun unit değerini yaz. Sonuçların tamamı tahmindir.`;

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const limited = rateLimit(`analyze-photo:${auth.user.id}`, 10, 60_000);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  if (!hasPhotoAiProvider() || process.env.AI_VISION_ENABLED === "false") {
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
    const generated = await generatePhotoAiObject({
      system: "Sen form.ai uygulamasının görsel besin ayrıştırma katmanısın. Yalnızca şemaya uygun JSON üret; besin değeri uydurma.",
      prompt,
      image,
      schema,
      temperature: 0.1,
      maxOutputTokens: 800,
      abortSignal: AbortSignal.timeout(25_000),
    });
    const parsed = validateParsedMeal(generated);
    if (!parsed) return Response.json({ error: "Fotoğraf sonucu güvenle doğrulanamadı; alanları elle düzenleyebilirsin." }, { status: 422 });
    const resolved = await resolveParsedMeal(request, parsed);
    const matched = resolved.items.filter((item) => item.food && item.nutrition);
    const totalGrams = resolved.items.reduce((sum, item) => sum + item.estimatedGrams, 0);
    const confidence = resolved.items.some((item) => item.confidence < 0.55)
      ? "low"
      : resolved.items.every((item) => item.confidence >= 0.8) ? "high" : "medium";
    const detectedItems = resolved.items.map((item) => ({
      name: item.query,
      catalogName: item.food?.name || null,
      grams: Math.round(item.estimatedGrams),
      preparation: item.preparation,
      confidence: item.confidence,
      needsConfirmation: item.needsConfirmation,
      matchKind: item.matchKind,
      nutrition: item.nutrition ? {
        calories: item.nutrition.calories,
        protein: item.nutrition.protein,
        carbs: item.nutrition.carbohydrates,
        fat: item.nutrition.fat,
        fiber: item.nutrition.fiber,
      } : null,
    }));
    return Response.json({
      ...resolved,
      detectedItems,
      name: resolved.items.map((item) => item.query).join(", ").slice(0, 120) || "Fotoğraftaki öğün",
      itemNames: resolved.items.map((item) => item.query),
      grams: Math.round(totalGrams),
      calories: resolved.totals.calories,
      protein: resolved.totals.protein,
      carbs: resolved.totals.carbohydrates,
      fat: resolved.totals.fat,
      fiber: resolved.totals.fiber,
      confidence,
      isEstimated: true,
      needsManualNutrition: matched.length !== resolved.items.length,
      // Sınır uygulanmıyorsa limit sonsuzdur; JSON'da null'a döneceği için atlanır.
      ...(Number.isFinite(usage.limit) ? { usage: { used: usage.used, limit: usage.limit } } : {}),
    });
  } catch (error) {
    console.error("[nutrition-photo] vision request failed", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "Fotoğraf analizi şu an tamamlanamadı; yazarak ekleyebilirsin." }, { status: 502 });
  }
}
