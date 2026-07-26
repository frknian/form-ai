import { jsonSchema } from "ai";
import { authenticateRequest } from "../../../../lib/api-auth.ts";
import { rateLimit, tooManyRequests } from "../../../../lib/rate-limit.ts";
import { generateAiObject, hasAiProvider, parseImageDataUrl } from "../../../../lib/ai-provider.ts";
import { checkAndConsumeUsage, usageLimitExceeded } from "../../../../lib/usage-limits.ts";

export const runtime = "edge";

type PhotoAnalysis = {
  name: string;
  items: string[];
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence: "low" | "medium" | "high";
};

const schema = jsonSchema<PhotoAnalysis>({
  type: "object",
  properties: {
    name: { type: "string" },
    items: { type: "array", items: { type: "string" } },
    grams: { type: "integer", minimum: 1, maximum: 3000 },
    calories: { type: "integer", minimum: 0 },
    protein: { type: "number", minimum: 0 },
    carbs: { type: "number", minimum: 0 },
    fat: { type: "number", minimum: 0 },
    fiber: { type: "number", minimum: 0 },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["name", "items", "grams", "calories", "protein", "carbs", "fat", "fiber", "confidence"],
});

const prompt = `Bu bir yemek fotoğrafı. Görevin:
1. Tabaktaki yemeği/yemekleri tanı ve Türkçe adlandır. Birden fazla bileşen varsa items dizisine ayrı ayrı yaz, name alanına bütünü özetleyen kısa bir ad koy (ör. "Tavuklu pilav ve salata").
2. Referans nesnelerden (tabak çapı, çatal, bardak, kaşık) ve porsiyon derinliğinden yararlanarak toplam yenebilir ağırlığı GRAM olarak tahmin et ve grams alanına yaz. Tabak, kase veya ambalaj ağırlığını dahil etme.
3. calories, protein, carbs, fat ve fiber değerlerini bu toplam gramaj İÇİN ver (100 g için değil, görünen porsiyonun tamamı için).
4. Makrolar tutarlı olsun: protein*4 + karbonhidrat*4 + yağ*9 toplamı kaloriye yakın olmalı.
5. Görüntü bulanıksa, porsiyon belirsizse veya yemek net tanınmıyorsa confidence="low" ver ve temkinli (abartısız) tek bir tahmin yap.
Tıbbi tavsiye veya kesinlik iddiası ekleme.`;

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const rateLimitResult = rateLimit(`analyze-photo:${auth.user.id}`, 10, 60000);
  if (!rateLimitResult.ok) return tooManyRequests(rateLimitResult.retryAfterSeconds);

  if (!hasAiProvider()) return Response.json({ error: "Fotoğraf analizi yapılandırılmamış." }, { status: 503 });
  const { photoDataUrl } = await request.json().catch(() => ({})) as { photoDataUrl?: unknown };
  if (typeof photoDataUrl !== "string") return Response.json({ error: "Geçerli bir yemek fotoğrafı gönderin." }, { status: 400 });
  const image = parseImageDataUrl(photoDataUrl);
  if (!image) return Response.json({ error: "Fotoğraf okunamadı veya çok büyük." }, { status: 400 });

  const usage = await checkAndConsumeUsage(request, "photo");
  if ("error" in usage) return usage.error;
  if (!usage.allowed) return usageLimitExceeded("photo", usage.used, usage.limit);

  try {
    const result = await generateAiObject({
      prompt,
      image,
      schema,
      temperature: 0.15,
      maxOutputTokens: 500,
      abortSignal: AbortSignal.timeout(25_000),
    });
    return Response.json({
      name: result.name.slice(0, 120) || "Fotoğraftaki öğün",
      items: result.items.map((item) => item.slice(0, 80)).slice(0, 8),
      grams: Math.min(3_000, Math.max(1, Math.round(result.grams))) || 100,
      calories: Math.max(0, Math.round(result.calories)),
      protein: Math.max(0, result.protein),
      carbs: Math.max(0, result.carbs),
      fat: Math.max(0, result.fat),
      fiber: Math.max(0, result.fiber),
      confidence: result.confidence,
      usage: { used: usage.used, limit: usage.limit },
    });
  } catch (error) {
    console.error("AI photo analysis error", error);
    return Response.json({ error: "Fotoğraf analizi şu an tamamlanamadı." }, { status: 502 });
  }
}
