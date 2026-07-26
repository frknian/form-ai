import { jsonSchema } from "ai";
import { authenticateRequest } from "@/lib/api-auth";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { generateAiObject, hasAiProvider } from "@/lib/ai-provider";

export const runtime = "edge";

type TextEstimate = {
  name: string;
  recognized: boolean;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence: "low" | "medium" | "high";
};

const schema = jsonSchema<TextEstimate>({
  type: "object",
  properties: {
    name: { type: "string" },
    recognized: { type: "boolean" },
    grams: { type: "integer", minimum: 1, maximum: 3000 },
    calories: { type: "integer", minimum: 0 },
    protein: { type: "number", minimum: 0 },
    carbs: { type: "number", minimum: 0 },
    fat: { type: "number", minimum: 0 },
    fiber: { type: "number", minimum: 0 },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["name", "recognized", "grams", "calories", "protein", "carbs", "fat", "fiber", "confidence"],
});

const instructions = `Kullanıcı yediği bir besini serbest metinle yazdı. Görevin:
1. Besini tanı ve düzgün bir adla name alanına yaz.
2. Metinde porsiyon belirtilmişse (ör. "2 dilim", "1 kase", "bir bardak", "150 g") onu gram karşılığına çevir. Porsiyon belirtilmemişse o besin için Türkiye'de yaygın tek porsiyonu varsay ve grams alanına yaz.
3. calories, protein, carbs, fat ve fiber değerlerini bu gramajın TAMAMI için ver (100 g için değil).
4. Makrolar tutarlı olsun: protein*4 + karbonhidrat*4 + yağ*9 toplamı kaloriye yakın olmalı.
5. Metin bir yiyecek/içecek tarif etmiyorsa recognized=false döndür ve sıfır değerler ver.
6. Emin değilsen confidence="low" ver ve temkinli, abartısız tek bir tahmin yap.
Tıbbi tavsiye veya kesinlik iddiası ekleme.`;

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  const rateLimitResult = rateLimit(`nutrition-estimate:${auth.user.id}`, 25, 60_000);
  if (!rateLimitResult.ok) return tooManyRequests(rateLimitResult.retryAfterSeconds);

  const body = await request.json().catch(() => ({})) as { query?: unknown; locale?: unknown };
  const query = typeof body.query === "string" ? body.query.trim().slice(0, 160) : "";
  if (query.length < 2) return Response.json({ error: "En az iki karakterlik bir besin adı gönderin." }, { status: 400 });

  if (!hasAiProvider()) return Response.json({ error: "Besin tahmini yapılandırılmamış." }, { status: 503 });

  const languageInstruction = body.locale === "en" ? "Besin adını (name) İngilizce yaz." : "Besin adını (name) Türkçe yaz.";
  try {
    const result = await generateAiObject({
      prompt: `${instructions}\n${languageInstruction}\n\nKULLANICI METNİ: ${query}`,
      schema,
      temperature: 0.15,
      maxOutputTokens: 300,
      abortSignal: AbortSignal.timeout(20_000),
    });
    if (!result.recognized) return Response.json({ recognized: false });
    return Response.json({
      recognized: true,
      name: result.name.trim() || query,
      grams: Math.min(3_000, Math.max(1, Math.round(result.grams))) || 100,
      calories: Math.max(0, Math.round(result.calories)),
      protein: Math.max(0, result.protein),
      carbs: Math.max(0, result.carbs),
      fat: Math.max(0, result.fat),
      fiber: Math.max(0, result.fiber),
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("AI nutrition estimate error", error);
    return Response.json({ error: "Besin tahmini şu an tamamlanamadı." }, { status: 502 });
  }
}
