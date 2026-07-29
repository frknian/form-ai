// Su tüketimi ve aralıklı oruç takibi. Zamanla ilgili tüm hesaplar burada saf
// fonksiyonlar olarak durur; bileşen yalnızca gösterir.

// Yaygın pratik kural: kilogram başına ~35 ml. Kesin bir tıbbi eşik değildir,
// yalnızca makul bir başlangıç hedefidir; antrenman ve sıcak havada ihtiyaç artar.
const ML_PER_KG = 35;
const MIN_GOAL_ML = 1_500;
const MAX_GOAL_ML = 4_000;

export function dailyWaterGoalMl(weightKg: number | null | undefined): number {
  const weight = Number(weightKg);
  if (!Number.isFinite(weight) || weight <= 0) return 2_000;
  return Math.min(MAX_GOAL_ML, Math.max(MIN_GOAL_ML, Math.round((weight * ML_PER_KG) / 100) * 100));
}

export function waterProgressPercent(consumedMl: number, goalMl: number): number {
  if (!Number.isFinite(consumedMl) || consumedMl <= 0 || goalMl <= 0) return 0;
  return Math.min(100, Math.round((consumedMl / goalMl) * 100));
}

export type FastingWindow = {
  startedAt: string;
  targetHours: number;
};

export type FastingState = {
  elapsedMinutes: number;
  targetMinutes: number;
  remainingMinutes: number;
  percent: number;
  complete: boolean;
};

/**
 * Oruç penceresinin anlık durumu. Yüzde 100'de sabitlenir: hedefi aşmak
 * "%140 tamamlandı" gibi anlamsız bir ilerleme çubuğu üretmemeli, ama geçen
 * süre olduğu gibi raporlanır.
 */
export function fastingState(window: FastingWindow, now: Date = new Date()): FastingState | null {
  const started = Date.parse(window.startedAt);
  const targetHours = Number(window.targetHours);
  if (!Number.isFinite(started) || !Number.isFinite(targetHours) || targetHours <= 0) return null;
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - started) / 60_000));
  const targetMinutes = Math.round(targetHours * 60);
  return {
    elapsedMinutes,
    targetMinutes,
    remainingMinutes: Math.max(0, targetMinutes - elapsedMinutes),
    percent: Math.min(100, Math.round((elapsedMinutes / targetMinutes) * 100)),
    complete: elapsedMinutes >= targetMinutes,
  };
}

/** "14s 30dk" biçimi; sıfır saatte yalnız dakika gösterilir. */
export function formatDuration(minutes: number, locale: "tr" | "en" = "tr"): string {
  const safe = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  const hourUnit = locale === "en" ? "h" : "s";
  const minuteUnit = locale === "en" ? "m" : "dk";
  if (!hours) return `${rest}${minuteUnit}`;
  return `${hours}${hourUnit} ${rest}${minuteUnit}`;
}
