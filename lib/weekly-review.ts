import { istanbulDateKey, istanbulWeek } from "./workout-calendar.ts";

export interface WeeklyReviewSummary {
  weekStart: string;
  goalCategory: "Kilo verme" | "Kas geliştirme" | "Kondisyon" | "Güçlenme" | "Genel fitness";
  sessionCount: number;
  completionRate: number;
  totalMinutes: number;
  easySessions: number;
  suitableSessions: number;
  hardSessions: number;
  averageFatigue: number | null;
  painAreas: string[];
  nutritionEntryCount: number;
  nutritionLoggedDays: number;
  averageCalories: number | null;
  averageProteinGrams: number | null;
  weightChangeKg: number | null;
  waistChangeCm: number | null;
}

export interface WeeklyReview {
  headline: string;
  summary: string;
  positives: string[];
  cautions: string[];
  recommendations: string[];
  safetyNote: string;
}

export type WeeklyReviewSource = "ai" | "local";

function finiteNumber(value: unknown, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : null;
}

function nullableNumber(value: unknown, min: number, max: number) {
  if (value === null || value === undefined) return null;
  return finiteNumber(value, min, max);
}

function cleanString(value: unknown, maxLength = 400) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanList(value: unknown, minItems: number, maxItems: number) {
  if (!Array.isArray(value)) return null;
  const list = value.map((item) => cleanString(item, 240)).filter(Boolean).slice(0, maxItems);
  return list.length >= minItems ? list : null;
}

export function validateWeeklySummary(value: unknown): WeeklyReviewSummary | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const weekStart = cleanString(item.weekStart, 10);
  const goal = cleanString(item.goalCategory, 40);
  const validGoals: WeeklyReviewSummary["goalCategory"][] = ["Kilo verme", "Kas geliştirme", "Kondisyon", "Güçlenme", "Genel fitness"];
  const sessionCount = finiteNumber(item.sessionCount, 0, 14);
  const completionRate = finiteNumber(item.completionRate, 0, 100);
  const totalMinutes = finiteNumber(item.totalMinutes, 0, 2_000);
  const easySessions = finiteNumber(item.easySessions, 0, 14);
  const suitableSessions = finiteNumber(item.suitableSessions, 0, 14);
  const hardSessions = finiteNumber(item.hardSessions, 0, 14);
  const nutritionEntryCount = finiteNumber(item.nutritionEntryCount, 0, 200);
  const nutritionLoggedDays = finiteNumber(item.nutritionLoggedDays, 0, 7);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !validGoals.includes(goal as WeeklyReviewSummary["goalCategory"]) || sessionCount === null || completionRate === null || totalMinutes === null || easySessions === null || suitableSessions === null || hardSessions === null || nutritionEntryCount === null || nutritionLoggedDays === null) return null;
  return {
    weekStart,
    goalCategory: goal as WeeklyReviewSummary["goalCategory"],
    sessionCount: Math.round(sessionCount),
    completionRate: Math.round(completionRate),
    totalMinutes: Math.round(totalMinutes),
    easySessions: Math.round(easySessions),
    suitableSessions: Math.round(suitableSessions),
    hardSessions: Math.round(hardSessions),
    averageFatigue: nullableNumber(item.averageFatigue, 1, 5),
    painAreas: Array.isArray(item.painAreas) ? item.painAreas.map((area) => cleanString(area, 30)).filter((area) => area && area !== "Yok").slice(0, 5) : [],
    nutritionEntryCount: Math.round(nutritionEntryCount),
    nutritionLoggedDays: Math.round(nutritionLoggedDays),
    averageCalories: nullableNumber(item.averageCalories, 0, 10_000),
    averageProteinGrams: nullableNumber(item.averageProteinGrams, 0, 1_000),
    weightChangeKg: nullableNumber(item.weightChangeKg, -50, 50),
    waistChangeCm: nullableNumber(item.waistChangeCm, -100, 100),
  };
}

export function validateWeeklyReview(value: unknown): WeeklyReview | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const headline = cleanString(item.headline, 100);
  const summary = cleanString(item.summary, 500);
  const positives = cleanList(item.positives, 1, 4);
  const cautions = cleanList(item.cautions, 1, 4);
  const recommendations = cleanList(item.recommendations, 2, 4);
  const safetyNote = cleanString(item.safetyNote, 300);
  if (!headline || !summary || !positives || !cautions || !recommendations || !safetyNote) return null;
  return { headline, summary, positives, cautions, recommendations, safetyNote };
}

export function weeklyReviewWeekStart(reference: Date | number = new Date()) {
  return istanbulWeek(reference)[0] || istanbulDateKey(reference);
}

export function weeklyGoalCategory(value: string): WeeklyReviewSummary["goalCategory"] {
  const normalized = value.toLocaleLowerCase("tr-TR");
  if (normalized.includes("kilo") || normalized.includes("yağ")) return "Kilo verme";
  if (normalized.includes("kas")) return "Kas geliştirme";
  if (normalized.includes("kondisyon")) return "Kondisyon";
  if (normalized.includes("güç")) return "Güçlenme";
  return "Genel fitness";
}

export function hasEnoughWeeklyData(summary: WeeklyReviewSummary) {
  const supportingSignal = summary.nutritionLoggedDays >= 2 || summary.weightChangeKg !== null || summary.waistChangeCm !== null;
  return summary.sessionCount >= 2 || (summary.sessionCount >= 1 && supportingSignal);
}

export function weeklySafetyRisk(summary: WeeklyReviewSummary) {
  return summary.painAreas.length > 0 || (summary.averageFatigue !== null && summary.averageFatigue >= 4);
}

function signed(value: number, unit: string) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ${unit}`;
}

export function localWeeklyReview(summary: WeeklyReviewSummary): WeeklyReview {
  const risk = weeklySafetyRisk(summary);
  const positives: string[] = [];
  const cautions: string[] = [];
  if (summary.completionRate >= 85) positives.push(`Planlanan hareketlerin %${summary.completionRate}'ini tamamladın; süreklilik açısından güçlü bir hafta.`);
  else if (summary.sessionCount > 0) positives.push(`${summary.sessionCount} antrenmanda toplam ${summary.totalMinutes} dakika hareket ettin.`);
  if (summary.nutritionLoggedDays >= 3) positives.push(`Beslenme günlüğünü ${summary.nutritionLoggedDays} farklı günde kullanarak değerlendirme için düzenli veri oluşturdun.`);
  if (summary.weightChangeKg !== null) positives.push(`Kilo ölçümündeki haftalık değişim ${signed(summary.weightChangeKg, "kg")}; tek haftalık dalgalanmadan çok uzun dönem eğilimini izle.`);
  if (summary.completionRate < 70) cautions.push("Tamamlama oranı düşük kaldı; gelecek hafta süreyi veya antrenman hacmini günlük programına daha uygun tut.");
  if (summary.averageFatigue !== null && summary.averageFatigue >= 4) cautions.push(`Ortalama yorgunluk ${summary.averageFatigue.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}/5 seviyesinde; yük artışı için uygun bir sinyal değil.`);
  if (summary.painAreas.length) cautions.push(`${summary.painAreas.join(" ve ")} bölgesinde ağrı bildirildi; ağrıyı zorlayarak ilerlemeye çalışma.`);
  if (summary.nutritionLoggedDays < 2) cautions.push("Beslenme kaydı az olduğu için enerji ve protein eğilimi hakkında güvenilir yorum yapılamıyor.");
  if (!cautions.length) cautions.push("Belirgin bir risk sinyali görünmüyor; yine de uyku, form kalitesi ve toparlanmayı izlemeye devam et.");
  const recommendations = risk ? [
    "Gelecek hafta ağırlık, set veya tekrar artırma; aynı düzeyi daha rahat ve temiz formla tamamlamayı hedefle.",
    "En az bir dinlenme veya düşük yoğunluklu hareket günü planla.",
    "Ağrı keskinleşir, sürer veya günlük yaşamını etkilerse antrenmanı durdurup uygun bir sağlık uzmanına danış.",
  ] : [
    summary.completionRate >= 85 ? "Mevcut planı bir hafta daha koru; yalnızca son setler belirgin biçimde kolay kalırsa küçük bir ilerleme düşün." : "Gelecek haftanın antrenmanlarını takvimde gerçekçi gün ve saatlere yerleştir.",
    "Her antrenmandan sonra zorluk, yorgunluk ve ağrı geri bildirimini eksiksiz gir.",
    summary.nutritionLoggedDays < 3 ? "En az üç gün beslenme kaydı ekleyerek haftalık eğilimi daha görünür hale getir." : "Beslenme kayıt düzenini koru; tek bir güne değil haftalık ortalamaya odaklan.",
  ];
  return {
    headline: risk ? "Bu hafta toparlanma öncelikli" : "Haftanın ritmi görünür hale geldi",
    summary: `${summary.sessionCount} antrenman, ${summary.totalMinutes} dakika ve %${summary.completionRate} hareket tamamlama oranı kaydedildi. Bu değerlendirme son 7 günün uygulama verilerine dayanır.`,
    positives: positives.length ? positives.slice(0, 4) : ["Bu hafta kayıt oluşturarak ilerlemeni karşılaştırılabilir hale getirdin."],
    cautions: cautions.slice(0, 4),
    recommendations: recommendations.slice(0, 4),
    safetyNote: "Bu değerlendirme tıbbi teşhis değildir. Keskin veya süren ağrı, göğüs ağrısı, baş dönmesi ya da yaralanma belirtisinde antrenmanı durdur ve uygun bir sağlık uzmanına başvur.",
  };
}

export function enforceWeeklySafety(review: WeeklyReview, summary: WeeklyReviewSummary) {
  if (!weeklySafetyRisk(summary)) return review;
  const increasePattern = /yük|ağırl|set|tekrar|hacim|yoğunluk/i;
  const unsafePattern = /artır|yükselt|ekle|çoğalt/i;
  const safeRecommendations = review.recommendations.filter((item) => !(increasePattern.test(item) && unsafePattern.test(item)));
  const recovery = "Ağırlık, set veya tekrar artırma; aynı düzeyi koruyup dinlenme ve temiz formu önceliklendir.";
  const painText = summary.painAreas.length ? `${summary.painAreas.join(" ve ")} bölgesindeki ağrı geri bildirimini zorlamadan takip et.` : "Yüksek yorgunluk sürerse ek dinlenme günü planla.";
  return {
    ...review,
    headline: "Bu hafta toparlanma öncelikli",
    cautions: [...new Set([painText, ...review.cautions])].slice(0, 4),
    recommendations: [...new Set([recovery, ...safeRecommendations, "En az bir dinlenme veya düşük yoğunluklu gün planla."])].slice(0, 4),
  };
}

export function weeklySummaryFingerprint(summary: WeeklyReviewSummary) {
  const raw = JSON.stringify(summary);
  return [...raw].reduce((hash, character) => (hash * 33 + character.charCodeAt(0)) % 2_147_483_647, 17).toString(36);
}
