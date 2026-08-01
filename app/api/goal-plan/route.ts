import { jsonSchema } from "ai";
import { generateAiObject, hasAiProvider, aiModelId } from "../../../lib/ai-provider.ts";
import { authenticateRequest } from "../../../lib/api-auth.ts";
import { rateLimit, tooManyRequests } from "../../../lib/rate-limit.ts";
import { normalizeAnswers, planGoal, goalPlanSummary, validateGoalAnalysis, type GoalAnalysis, type GoalPlanProjection } from "../../../lib/goal-plan.ts";
import { tr } from "../../../lib/i18n/dictionaries/tr.ts";
import { en } from "../../../lib/i18n/dictionaries/en.ts";

export const runtime = "edge";

const analysisSchema = jsonSchema<GoalAnalysis>({
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string", minLength: 1, maxLength: 90 },
    assessment: { type: "string", minLength: 1, maxLength: 420 },
    steps: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 200 } },
    safetyNote: { type: "string", minLength: 1, maxLength: 260 },
  },
  required: ["headline", "assessment", "steps", "safetyNote"],
});

/**
 * AI yoksa ya da yanıt vermezse kullanılan analiz.
 *
 * Sayılar zaten yerel olarak hesaplandığı için bu metin "yedek" değil, geçerli
 * bir analizdir; AI onu yalnız kişiselleştirir. Kart hiçbir koşulda boş kalmaz.
 */
function localAnalysis(projection: GoalPlanProjection, dictionary: typeof tr): GoalAnalysis {
  const copy = dictionary.goalPlan.local;
  const steps: string[] = [
    projection.dailyIntakeKcal === null ? copy.stepSetNutrition : copy.stepIntake(projection.dailyIntakeKcal),
    copy.stepTraining(projection.dailyTrainingBurnKcal),
    copy.stepWeighIn,
  ];
  if (projection.warnings.includes("clampedToSafeRate")) steps.push(copy.stepClamped);

  return {
    headline: copy.headline(projection.weeks, projection.remainingKg),
    assessment: copy.assessment(projection.remainingKg, Math.abs(projection.weeklyRateKg), projection.weeks),
    steps: steps.slice(0, 4),
    safetyNote: projection.warnings.includes("intakeBelowBmr") ? copy.safetyBelowBmr : copy.safetyDefault,
  };
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth.error;
  // Hedef planı seyrek kurulur; sohbet gibi günlük kotaya değil, yalnız
  // kötüye kullanımı engelleyen bir hız sınırına bağlı.
  const limit = rateLimit(`goal-plan:${auth.user.id}`, 10, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Hedef verileri okunamadı" }, { status: 400 });
  }

  const locale = payload.locale === "en" ? "en" : "tr";
  const dictionary = locale === "en" ? en : tr;

  const answers = normalizeAnswers(payload.answers);
  const currentWeightKg = Number(payload.currentWeightKg);
  if (!answers || !Number.isFinite(currentWeightKg) || currentWeightKg <= 0) {
    return Response.json({ error: "Hedef bilgileri eksik" }, { status: 400 });
  }

  const bmrValue = Number(payload.bmr);
  const plan = planGoal(answers, { currentWeightKg, bmr: Number.isFinite(bmrValue) && bmrValue > 0 ? bmrValue : null });
  if (plan.status !== "ready") return Response.json({ status: plan.status }, { status: 200 });

  const summary = goalPlanSummary(answers, plan, currentWeightKg);
  const fallback = localAnalysis(plan, dictionary);
  if (!hasAiProvider()) return Response.json({ status: "ready", plan, analysis: fallback, source: "local" });

  const languageRule = locale === "en"
    ? "- Write entirely in English: short, concrete, encouraging."
    : "- Tamamen Türkçe yaz: kısa, somut, cesaretlendirici.";

  try {
    const output = await generateAiObject({
      schema: analysisSchema,
      system: `Sen Hedefit uygulamasının hedef planlama asistanısın.
- Sana VERİLEN sayılar uygulamada zaten hesaplandı. Yeni tarih, yeni haftalık hız veya yeni kalori sayısı UYDURMA; verilen değerleri yorumla.
${languageRule}
- assessment alanında hedefin bu tempoyla gerçekçi olup olmadığını, antrenmanın ve beslenmenin payını açıkla.
- steps alanında kullanıcının bu hafta yapabileceği 2–4 somut adım yaz.
- warnings içinde "clampedToSafeRate" varsa istenen temponun güvenli sınıra çekildiğini söyle.
- warnings içinde "intakeBelowBmr" varsa kalori hedefinin bazal ihtiyacın altında kaldığını belirt ve bir uzmana danışmayı öner.
- Tıbbi teşhis koyma, ilaç veya takviye önerme, "garanti" gibi kesinlik ifadeleri kullanma.
- Vücut görünümü hakkında yargı bildirme; yalnız kullanıcının kendi belirlediği hedefe odaklan.`,
      prompt: `KULLANICININ HEDEF PLANI (anonim, uygulamada hesaplanmış):\n${JSON.stringify(summary)}\n\nBu veriler dışında bir şey varsayma.`,
      maxOutputTokens: 700,
      temperature: 0.3,
      abortSignal: AbortSignal.timeout(20_000),
    });
    const validated = validateGoalAnalysis(output);
    if (!validated) throw new Error("Model yanıtı doğrulanamadı");
    return Response.json({ status: "ready", plan, analysis: validated, source: "ai", model: aiModelId() });
  } catch {
    return Response.json({ status: "ready", plan, analysis: fallback, source: "local" });
  }
}
