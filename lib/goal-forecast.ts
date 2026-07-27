// Hedef kiloya ne kadar sürede ulaşılacağının tahmini.
//
// Asıl model ENERJİ DENGESİdir: günlük harcama (dinlenme metabolizması + senin
// kaydettiğin antrenman ve aktiviteler) ile günlük alım (kaydettiğin öğünler ya
// da beslenme hedefi) arasındaki fark, kilo değişimine çevrilir. Yani tahmin
// "verilen antrenman + verilen kalori açığı + gün içindeki hareket" üzerinden
// ileriye dönük hesaplanır.
//
// Ölçülen kilo trendi ayrıca hesaplanır ama tahminin yerine geçmez; gerçeğin
// plandan sapıp sapmadığını göstermek için bir kontrol noktası olarak sunulur.
//
// Yeterli veri yoksa tarih UYDURULMAZ; durum açıkça bildirilir.

// 1 kg vücut yağı ≈ 7700 kcal. Yaklaşıklıktır: gerçek değişim su, glikojen ve
// kas kaybı/kazancını da içerir, bu yüzden tahmin kesinlik iddiası taşımaz.
const KCAL_PER_KG = 7_700;

// Harcamayı "dinlenme + kaydedilen hareket" olarak kurarken hareketsiz bir taban
// kullanırız. TDEE'nin içinde zaten varsayılan bir antrenman payı olduğu için
// onun üstüne kaydedilen antrenmanı eklemek aynı kaloriyi iki kez sayardı.
const SEDENTARY_MULTIPLIER = 1.2;

const ENERGY_WINDOW_DAYS = 28;
// Bu kadar farklı günde kayıt yoksa ortalama temsil etmez; ilan edilen yaşam
// tarzı tahmini (TDEE) ve beslenme hedefi daha güvenilirdir.
const MIN_LOGGED_ACTIVITY_DAYS = 5;
const MIN_LOGGED_INTAKE_DAYS = 5;

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
export type CalorieEntry = { dateIso: string; calories: number };

export type EnergyProjection = {
  /** Günlük toplam harcama (kcal). */
  expenditureKcal: number;
  /** Günlük toplam alım (kcal). */
  intakeKcal: number;
  /** Alım − harcama. Negatif = açık (kilo verme yönü). */
  balanceKcal: number;
  /** Kaydedilen antrenman + aktivitelerden gelen günlük ortalama (kcal). */
  activityKcal: number;
  weeklyRateKg: number;
  expenditureBasis: "logged" | "tdee";
  intakeBasis: "logged" | "target";
};

export type GoalForecastInput = {
  currentWeightKg: number | null | undefined;
  targetWeightKg: number | null | undefined;
  measurements?: WeightPoint[];
  bmr?: number | null;
  tdee?: number | null;
  calorieTarget?: number | null;
  /** workout_sessions ve sport_activity_entries kayıtları. */
  activityEntries?: CalorieEntry[];
  /** food_entries kayıtları. */
  intakeEntries?: CalorieEntry[];
  today?: Date;
};

export type GoalForecast =
  | { status: "needs-weight" }
  | { status: "needs-target" }
  | { status: "reached"; remainingKg: 0 }
  | { status: "no-rate"; remainingKg: number; losing: boolean; energy: EnergyProjection | null }
  | { status: "wrong-direction"; remainingKg: number; weeklyRateKg: number; losing: boolean; energy: EnergyProjection | null }
  | {
      status: "ready";
      remainingKg: number;
      weeklyRateKg: number;
      weeks: number;
      etaIso: string;
      source: "energy" | "measured";
      energy: EnergyProjection | null;
      /** Ölçümlerden gelen gerçek hız; plandan sapmayı göstermek için. */
      measuredWeeklyRateKg: number | null;
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

function localDayKey(dateIso: string) {
  return dateIso.slice(0, 10);
}

/** Pencere içindeki kayıtları gün gün toplar. */
function dailyTotals(entries: CalorieEntry[], today: Date, windowDays: number) {
  const cutoff = today.getTime() / 86_400_000 - windowDays;
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const day = dayNumber(entry.dateIso);
    if (day === null || day < cutoff || !isFiniteNumber(entry.calories) || entry.calories < 0) continue;
    const key = localDayKey(entry.dateIso);
    totals.set(key, (totals.get(key) ?? 0) + entry.calories);
  }
  return totals;
}

/**
 * Enerji dengesinden haftalık kilo değişimi. Harcama, mümkünse kaydedilen
 * hareket üzerinden; alım, mümkünse kaydedilen öğünler üzerinden hesaplanır.
 * Hiçbir dayanak yoksa null.
 */
export function projectEnergyBalance(input: GoalForecastInput): EnergyProjection | null {
  const today = input.today ?? new Date();
  const bmr = isFiniteNumber(input.bmr) && input.bmr > 0 ? input.bmr : null;
  const tdee = isFiniteNumber(input.tdee) && input.tdee > 0 ? input.tdee : null;

  const activityTotals = dailyTotals(input.activityEntries ?? [], today, ENERGY_WINDOW_DAYS);
  // Hareket ortalaması pencerenin TAMAMINA bölünür: hareket edilmeyen günler de
  // gerçek günlerdir, yalnız antrenman günlerine bölmek harcamayı şişirirdi.
  const activitySum = [...activityTotals.values()].reduce((total, value) => total + value, 0);
  const activityKcal = activitySum / ENERGY_WINDOW_DAYS;
  const hasEnoughActivity = activityTotals.size >= MIN_LOGGED_ACTIVITY_DAYS;

  let expenditureKcal: number;
  let expenditureBasis: "logged" | "tdee";
  if (bmr !== null && hasEnoughActivity) {
    expenditureKcal = bmr * SEDENTARY_MULTIPLIER + activityKcal;
    expenditureBasis = "logged";
  } else if (tdee !== null) {
    expenditureKcal = tdee;
    expenditureBasis = "tdee";
  } else if (bmr !== null) {
    expenditureKcal = bmr * SEDENTARY_MULTIPLIER + activityKcal;
    expenditureBasis = "logged";
  } else {
    return null;
  }

  const intakeTotals = dailyTotals(input.intakeEntries ?? [], today, ENERGY_WINDOW_DAYS);
  // Alım yalnız KAYIT GİRİLEN günlere bölünür: kayıt girilmeyen günü "0 kalori
  // yedi" saymak devasa sahte bir açık üretirdi.
  const intakeSum = [...intakeTotals.values()].reduce((total, value) => total + value, 0);
  const hasEnoughIntake = intakeTotals.size >= MIN_LOGGED_INTAKE_DAYS;
  const target = isFiniteNumber(input.calorieTarget) && input.calorieTarget > 0 ? input.calorieTarget : null;

  let intakeKcal: number;
  let intakeBasis: "logged" | "target";
  if (hasEnoughIntake) {
    intakeKcal = intakeSum / intakeTotals.size;
    intakeBasis = "logged";
  } else if (target !== null) {
    intakeKcal = target;
    intakeBasis = "target";
  } else {
    return null;
  }

  const balanceKcal = intakeKcal - expenditureKcal;
  return {
    expenditureKcal,
    intakeKcal,
    balanceKcal,
    activityKcal,
    weeklyRateKg: (balanceKcal * 7) / KCAL_PER_KG,
    expenditureBasis,
    intakeBasis,
  };
}

/**
 * Ölçümlerden en küçük kareler eğimiyle kg/hafta döndürür.
 * Günlük kilo ±1-2 kg oynadığı için iki nokta arasındaki fark yanıltıcıdır.
 */
export function measuredWeeklyRate(measurements: WeightPoint[], today = new Date()): number | null {
  const windowStart = today.getTime() / 86_400_000 - MEASUREMENT_WINDOW_DAYS;
  const points = measurements
    .map((point) => ({ day: dayNumber(point.dateIso), weightKg: point.weightKg }))
    .filter((point): point is { day: number; weightKg: number } => point.day !== null && isFiniteNumber(point.weightKg) && point.weightKg > 0)
    .filter((point) => point.day >= windowStart)
    .sort((a, b) => a.day - b.day);

  if (points.length < MIN_MEASUREMENTS) return null;
  if (points[points.length - 1].day - points[0].day < MIN_MEASUREMENT_SPAN_DAYS) return null;

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

  const energy = projectEnergyBalance(input);
  const measured = measuredWeeklyRate(input.measurements ?? [], today);

  // Kullanıcının istediği model enerji dengesi; ölçüm yalnız kontrol noktası.
  // Enerji hesaplanamıyorsa (beslenme hedefi hiç kurulmamışsa) ölçüme düşeriz.
  const energyRate = energy && Math.abs(energy.weeklyRateKg) >= MIN_MEANINGFUL_RATE_KG ? energy.weeklyRateKg : null;
  const measuredRate = measured !== null && Math.abs(measured) >= MIN_MEANINGFUL_RATE_KG ? measured : null;
  const weeklyRateKg = energyRate ?? measuredRate;
  const source: "energy" | "measured" = energyRate !== null ? "energy" : "measured";

  if (weeklyRateKg === null) return { status: "no-rate", remainingKg, losing, energy };

  // Hız hedefin ters yönündeyse bölmek "negatif süre" üretirdi.
  const movingTowardTarget = losing ? weeklyRateKg < 0 : weeklyRateKg > 0;
  if (!movingTowardTarget) return { status: "wrong-direction", remainingKg, weeklyRateKg, losing, energy };

  const weeks = remainingKg / Math.abs(weeklyRateKg);
  const beyondHorizon = weeks > MAX_HORIZON_WEEKS;
  const eta = new Date(today.getTime() + Math.min(weeks, MAX_HORIZON_WEEKS) * 7 * 86_400_000);

  return {
    status: "ready",
    remainingKg,
    weeklyRateKg,
    weeks: Math.max(1, Math.round(weeks)),
    etaIso: eta.toISOString().slice(0, 10),
    source,
    energy,
    measuredWeeklyRateKg: measured,
    losing,
    // Haftada vücut ağırlığının %1'inden hızlı değişim sürdürülebilir değildir.
    aggressive: Math.abs(weeklyRateKg) > current * 0.01,
    beyondHorizon,
  };
}
