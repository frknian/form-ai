import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, jsonSchema, Output } from "ai";
import { enforceWeeklySafety, hasEnoughWeeklyData, localWeeklyReview, validateWeeklyReview, validateWeeklySummary, type WeeklyReview } from "../../../lib/weekly-review.ts";

export const runtime = "edge";

const weeklyReviewSchema = jsonSchema<WeeklyReview>({
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string", minLength: 1, maxLength: 100 },
    summary: { type: "string", minLength: 1, maxLength: 500 },
    positives: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 240 } },
    cautions: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 240 } },
    recommendations: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 240 } },
    safetyNote: { type: "string", minLength: 1, maxLength: 300 },
  },
  required: ["headline", "summary", "positives", "cautions", "recommendations", "safetyNote"],
}, {
  validate: (value) => {
    const review = validateWeeklyReview(value);
    return review ? { success: true, value: review } : { success: false, error: new Error("Haftalık değerlendirme şemaya uymuyor") };
  },
});

export async function POST(request: Request) {
  let payload: { summary?: unknown };
  try {
    payload = await request.json() as { summary?: unknown };
  } catch {
    return Response.json({ error: "Haftalık özet okunamadı" }, { status: 400 });
  }

  const safeSummary = validateWeeklySummary(payload.summary);
  if (!safeSummary) return Response.json({ error: "Haftalık özet geçersiz" }, { status: 400 });
  if (!hasEnoughWeeklyData(safeSummary)) return Response.json({ error: "Değerlendirme için yeterli veri yok" }, { status: 422 });

  const fallback = enforceWeeklySafety(localWeeklyReview(safeSummary), safeSummary);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ review: fallback, source: "local", reason: "AI yapılandırılmadığı için güvenli yerel değerlendirme kullanıldı." });

  const google = createGoogleGenerativeAI({ apiKey });
  try {
    const { output } = await generateText({
      model: google(process.env.GEMINI_MODEL || "gemini-3.5-flash"),
      output: Output.object({ name: "WeeklyFitnessReview", description: "Türkçe, kısa ve güvenli haftalık fitness değerlendirmesi", schema: weeklyReviewSchema }),
      system: `Sen form.ai uygulamasının güvenli haftalık fitness değerlendirme asistanısın.
- Yalnızca verilen anonim özet metriklerini kullan; kişisel veri, tanı veya kesin sağlık iddiası üretme.
- Çıktı Türkçe, kısa, somut ve destekleyici olsun.
- positives olumlu gelişmeleri, cautions dikkat noktalarını, recommendations gelecek hafta için 2–4 uygulanabilir adımı içersin.
- Ağrı alanı varsa veya ortalama yorgunluk 4/5 ve üzerindeyse yük, ağırlık, set, tekrar ya da yoğunluk artırmayı önerme. Dinlenme, form kalitesi ve güvenli toparlanmayı öner.
- Kilo, bel veya beslenme değişimini tek başına sağlık sonucu gibi yorumlama.
- Tıbbi teşhis, tedavi veya kesin kalori hedefi verme.`,
      prompt: `SON 7 GÜNÜN ANONİM HAFTALIK ÖZETİ:\n${JSON.stringify(safeSummary)}\n\nBu özet dışında veri varsayma.`,
      maxOutputTokens: 900,
      temperature: 0.25,
      abortSignal: AbortSignal.timeout(12_000),
    });
    const validated = validateWeeklyReview(output);
    if (!validated) throw new Error("Model yanıtı doğrulanamadı");
    return Response.json({ review: enforceWeeklySafety(validated, safeSummary), source: "ai", model: process.env.GEMINI_MODEL || "gemini-3.5-flash" });
  } catch {
    return Response.json({ review: fallback, source: "local", reason: "AI yanıtı alınamadığı için güvenli yerel değerlendirme kullanıldı." });
  }
}
