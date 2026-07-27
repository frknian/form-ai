// Hedef kiloya ne kadar sürede ulaşılacağının tahmini.
//
// İki bilgi kaynağı vardır ve ölçülen gerçek veri her zaman önceliklidir:
//   1. "measured" — kullanıcının kendi kilo ölçümlerinden en küçük kareler ile
//      hesaplanan gerçek haftalık değişim. Günlük kilo ±1-2 kg oynadığı için iki
//      nokta arasındaki farkı almak yanıltıcıdır; eğim tüm noktalara bakar.
//   2. "plan" — henüz yeterli ölçüm yoksa, beslenme hedefindeki günlük kalori
//      açığından/fazlasından türetilen teorik hız.
//
// Yeterli veri yoksa tarih UYDURULMAZ; durum açıkça bildirilir. Tahmin, sağlıklı
// kabul edilen hızın (haftada vücut ağırlığının ~%1'i) üzerindeyse işaretlenir.

// 1 kg vücut yağı ≈ 7700 kcal. Bu bir yaklaşıklıktır: gerçek değişim su, glikojen
// ve kas kaybı/kazancını da içerir, bu yüzden tahmin kesinlik iddiası taşımaz.
const KCAL_PER_KG = 7_700;

const MEASUREMENT_WINDOW_DAYS = 90;
const MIN_MEASUREMENT_SPAN_DAYS = 14;
const MIN_MEASUREMENTS = 2;
// Bu eşiğin altındaki hız pratikte "yerinde sayıyor" demektir; bölünce tahmin
// yüzlerce haftaya fırlar ve anlamsız bir tarih üretir.
const MIN_MEANINGFUL_RATE_KG = 0.05;
const MAX_HORIZON_WEEKS = 104;
// Hedefe bu kadar yaklaşıldıysa ulaşılmış sayılır (tartı hassasiyeti payı).
const REACHED_TOLERANCE_KG = 0.3;

export type WeightPoint = { dateIso: string; weightKg: number };

export type GoalForecastInput = {
  currentWeightKg: number | null | undefined;
  targetWeightKg: number | null | undefined;
  measurements?: WeightPoint[];
  /** Beslenme hedefindeki günlük kalori farkı; negatif = açık (kilo verme). */
  calorieAdjustmentPerDay?: number | null;
  today?: Date;
};

export type GoalForecast =
  | { status: "needs-weight" }
  | { status: "needs-target" }
  | { status: "reached"; remainingKg: 0 }
  | { status: "no-rate"; remainingKg: number; losing: boolean }
  | { status: "wrong-direction"; remainingKg: number; weeklyRateKg: number; losing: boolean }
  | {
      status: "ready";
      remainingKg: number;
      weeklyRateKg: number;
      weeks: number;
      etaIso: string;
      source: "measured" | "plan";
      losing: boolean;
      aggressive: boolean;
      beyondHorizon: boolean;
    };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function dayNumber(dateIso: string) {
  const time = Date.parse(dateIso);
  return Number.isNaN(time) ? null : time / 86_400_000;
}

/**
 * Ölçümlerden en küçük kareler eğimiyle kg/hafta döndürür.
 * Yeterli veya yeterince uzun aralıklı veri yoksa null.
 */
export function measuredWeeklyRate(measurements: WeightPoint[], today = new Date()): number | null {
  const windowStart = today.getTime() / 86_400_000 - MEASUREMENT_WINDOW_DAYS;
  const points = measurements
    .map((point) => ({ day: dayNumber(point.dateIso), weightKg: point.weightKg }))
    .filter((point): point is { day: number; weightKg: number } => point.day !== null && isFiniteNumber(point.weightKg) && point.weightKg > 0)
    .filter((point) => point.day >= windowStart)
    .sort((a, b) => a.day - b.day);

  if (points.length < MIN_MEASUREMENTS) return null;
  const span = points[points.length - 1].day - points[0].day;
  if (span < MIN_MEASUREMENT_SPAN_DAYS) return null;

  const meanDay = points.reduce((total, point) => total + point.day, 0) / points.length;
  const meanWeight = points.reduce((total, point) => total + point.weightKg, 0) / points.length;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    const dx = point.day - meanDay;
    numerator += dx * (point.weightKg - meanWeight);
    denominator += dx * dx;
  }
  if (denominator === 0) return null;
  return (numerator / denominator) * 7;
}

/** Günlük kalori farkından teorik kg/hafta. */
export function plannedWeeklyRate(calorieAdjustmentPerDay: number | null | undefined): number | null {
  if (!isFiniteNumber(calorieAdjustmentPerDay) || calorieAdjustmentPerDay === 0) return null;
  return (calorieAdjustmentPerDay * 7) / KCAL_PER_KG;
}

export function forecastGoal(input: GoalForecastInput): GoalForecast {
  const today = input.today ?? new Date();
  const current = input.currentWeightKg;
  const target = input.targetWeightKg;
  if (!isFiniteNumber(current) || current <= 0) return { status: "needs-weight" };
  if (!isFiniteNumber(target) || target <= 0) return { status: "needs-target" };

  const difference = target - current;
  const remainingKg = Math.abs(difference);
  if (remainingKg <= REACHED_TOLERANCE_KG) return { status: "reached", remainingKg: 0 };
  const losing = difference < 0;

  const measured = measuredWeeklyRate(input.measurements ?? [], today);
  const planned = plannedWeeklyRate(input.calorieAdjustmentPerDay);
  const usingMeasured = measured !== null && Math.abs(measured) >= MIN_MEANINGFUL_RATE_KG;
  const weeklyRateKg = usingMeasured ? (measured as number) : planned;
  const source: "measured" | "plan" = usingMeasured ? "measured" : "plan";

  if (weeklyRateKg === null || Math.abs(weeklyRateKg) < MIN_MEANINGFUL_RATE_KG) {
    return { status: "no-rate", remainingKg, losing };
  }
  // Hız hedefin ters yönündeyse bölme yapmak "negatif süre" üretirdi.
  const movingTowardTarget = losing ? weeklyRateKg < 0 : weeklyRateKg > 0;
  if (!movingTowardTarget) return { status: "wrong-direction", remainingKg, weeklyRateKg, losing };

  const weeks = remainingKg / Math.abs(weeklyRateKg);
  const beyondHorizon = weeks > MAX_HORIZON_WEEKS;
  const cappedWeeks = beyondHorizon ? MAX_HORIZON_WEEKS : weeks;
  const eta = new Date(today.getTime() + cappedWeeks * 7 * 86_400_000);
  // Haftada vücut ağırlığının %1'inden hızlı değişim sürdürülebilir değildir.
  const aggressive = Math.abs(weeklyRateKg) > current * 0.01;

  return {
    status: "ready",
    remainingKg,
    weeklyRateKg,
    weeks: Math.max(1, Math.round(weeks)),
    etaIso: eta.toISOString().slice(0, 10),
    source,
    losing,
    aggressive,
    beyondHorizon,
  };
}
