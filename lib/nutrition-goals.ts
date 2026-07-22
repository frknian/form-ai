export type NutritionGoalType = "lose" | "maintain" | "gain";

export interface NutritionGoal {
  goalType: NutritionGoalType;
  calorieTarget: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  bmr: number;
  tdee: number;
  calorieAdjustment: number;
  activityFactor: number;
  workoutDays: number;
  isManual: boolean;
}

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface WeightMeasurement {
  measuredAt: string;
  weightKg: number | null;
}

export interface WeightTrend {
  weeklyKg: number;
  weeklyPercent: number;
  days: number;
}

const goalLabels: Record<NutritionGoalType, string> = {
  lose: "Kilo verme",
  maintain: "Kilo koruma",
  gain: "Kas kazanımı",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function nutritionGoalLabel(goalType: NutritionGoalType) {
  return goalLabels[goalType];
}

export function inferNutritionGoal(goalText: string): NutritionGoalType {
  const normalized = goalText.toLocaleLowerCase("tr-TR");
  if (normalized.includes("kilo") || normalized.includes("yağ") || normalized.includes("zayıf")) return "lose";
  if (normalized.includes("kas") || normalized.includes("hacim")) return "gain";
  return "maintain";
}

export function inferWorkoutDays(value: string) {
  const normalized = value.toLocaleLowerCase("tr-TR");
  if (normalized.includes("5+")) return 5;
  const values = normalized.match(/\d+/g)?.map(Number).filter(Number.isFinite) || [];
  if (!values.length) return 3;
  return clamp(Math.round(values.reduce((sum, item) => sum + item, 0) / values.length), 0, 7);
}

export function calculateNutritionGoal(input: {
  goalType: NutritionGoalType;
  bmr: number;
  tdee: number;
  weightKg: number;
  activityFactor: number;
  workoutDays: number;
}): NutritionGoal {
  const bmr = Math.round(clamp(input.bmr, 800, 4_500));
  const tdee = Math.round(clamp(input.tdee, bmr, 7_000));
  const weightKg = clamp(input.weightKg, 30, 350);
  const workoutDays = Math.round(clamp(input.workoutDays, 0, 7));
  const desiredAdjustment = input.goalType === "lose"
    ? -Math.round(clamp(tdee * 0.15, 250, 500))
    : input.goalType === "gain"
      ? Math.round(clamp(tdee * 0.08, 150, 300))
      : 0;
  const calorieTarget = input.goalType === "lose"
    ? Math.max(bmr, tdee + desiredAdjustment)
    : tdee + desiredAdjustment;
  const calorieAdjustment = calorieTarget - tdee;
  const proteinMultiplier = input.goalType === "maintain" ? 1.6 : 1.8;
  const proteinGrams = Math.round(weightKg * proteinMultiplier);
  const fatMultiplier = input.goalType === "gain" ? 0.9 : 0.8;
  const fatGrams = Math.round(Math.max(weightKg * fatMultiplier, calorieTarget * 0.2 / 9));
  const remainingCalories = Math.max(0, calorieTarget - proteinGrams * 4 - fatGrams * 9);
  const trainingCarbBoost = workoutDays >= 4 ? Math.min(20, workoutDays * 3) : 0;
  const carbsGrams = Math.round(remainingCalories / 4 + trainingCarbBoost);
  const adjustedFatGrams = Math.max(30, Math.round((calorieTarget - proteinGrams * 4 - carbsGrams * 4) / 9));

  return {
    goalType: input.goalType,
    calorieTarget,
    proteinGrams,
    carbsGrams,
    fatGrams: adjustedFatGrams,
    bmr,
    tdee,
    calorieAdjustment,
    activityFactor: clamp(input.activityFactor, 1.1, 2.2),
    workoutDays,
    isManual: false,
  };
}

export function sanitizeNutritionGoal(value: unknown): NutritionGoal | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (!(["lose", "maintain", "gain"] as unknown[]).includes(item.goalType)) return null;
  const number = (field: string, min: number, max: number) => {
    const parsed = Number(item[field]);
    return Number.isFinite(parsed) ? clamp(Math.round(parsed), min, max) : null;
  };
  const calorieTarget = number("calorieTarget", 800, 7_000);
  const proteinGrams = number("proteinGrams", 0, 600);
  const carbsGrams = number("carbsGrams", 0, 1_000);
  const fatGrams = number("fatGrams", 0, 400);
  const bmr = number("bmr", 800, 4_500);
  const tdee = number("tdee", 800, 7_000);
  const calorieAdjustment = number("calorieAdjustment", -3_000, 3_000);
  const workoutDays = number("workoutDays", 0, 7);
  const activityFactor = Number(item.activityFactor);
  if ([calorieTarget, proteinGrams, carbsGrams, fatGrams, bmr, tdee, calorieAdjustment, workoutDays].some((field) => field === null) || !Number.isFinite(activityFactor)) return null;
  return { goalType: item.goalType as NutritionGoalType, calorieTarget: calorieTarget!, proteinGrams: proteinGrams!, carbsGrams: carbsGrams!, fatGrams: fatGrams!, bmr: bmr!, tdee: tdee!, calorieAdjustment: calorieAdjustment!, activityFactor: clamp(activityFactor, 1.1, 2.2), workoutDays: workoutDays!, isManual: Boolean(item.isManual) };
}

export function nutritionGoalWarning(goal: NutritionGoal) {
  const adjustmentPercent = goal.tdee ? goal.calorieAdjustment / goal.tdee : 0;
  if (goal.calorieTarget < goal.bmr) return "Kalori hedefi tahmini bazal enerji ihtiyacının altında. Bu kadar düşük bir hedefi uygulamadan önce diyetisyen veya hekim desteği al.";
  if (adjustmentPercent <= -0.25 || goal.calorieAdjustment <= -750) return "Seçilen kalori açığı oldukça yüksek. Daha küçük ve sürdürülebilir bir açık belirlemek daha güvenli olabilir.";
  if (adjustmentPercent >= 0.15 || goal.calorieAdjustment >= 500) return "Seçilen kalori fazlası hızlı kilo artışına yol açabilir. Daha küçük bir fazla ile ilerlemeyi düşün.";
  return null;
}

export function nextMealSuggestion(totals: NutritionTotals, goal: NutritionGoal) {
  const calorieRatio = totals.calories / Math.max(1, goal.calorieTarget);
  const proteinRatio = totals.protein / Math.max(1, goal.proteinGrams);
  const carbsRatio = totals.carbs / Math.max(1, goal.carbsGrams);
  const fatRatio = totals.fat / Math.max(1, goal.fatGrams);
  if (calorieRatio >= 1.05) return "Kalori hedefini aştın. Sonraki öğünde açlık durumuna göre sebze, su ve daha hafif protein kaynaklarına odaklan.";
  if (proteinRatio < Math.min(carbsRatio, fatRatio) && proteinRatio < 0.85) return "Protein hedefin geride. Sonraki öğünde yoğurt, yumurta, baklagil, balık veya yağsız et gibi bir protein kaynağı ekle.";
  if (carbsRatio < 0.7 && goal.workoutDays >= 3) return "Karbonhidrat hedefin geride. Antrenman enerjisi için yulaf, bulgur, tam tahıl, meyve veya patates gibi bir kaynak seç.";
  if (fatRatio < 0.65) return "Yağ hedefin geride. Porsiyonu kontrollü tutarak zeytinyağı, avokado veya kuruyemiş gibi bir kaynak ekleyebilirsin.";
  return "Makroların dengeli ilerliyor. Sonraki öğünde sebze çeşitliliği, yeterli su ve porsiyon kontrolüne odaklan.";
}

export function calculateWeeklyWeightTrend(measurements: WeightMeasurement[]): WeightTrend | null {
  const valid = measurements
    .filter((item): item is { measuredAt: string; weightKg: number } => typeof item.weightKg === "number" && Number.isFinite(item.weightKg))
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  if (valid.length < 2) return null;
  const firstTime = new Date(`${valid[0].measuredAt}T12:00:00Z`).getTime();
  const lastTime = new Date(`${valid[valid.length - 1].measuredAt}T12:00:00Z`).getTime();
  const days = Math.round((lastTime - firstTime) / 86_400_000);
  if (days < 5) return null;
  const weeklyKg = (valid[valid.length - 1].weightKg - valid[0].weightKg) / days * 7;
  return { weeklyKg: Number(weeklyKg.toFixed(2)), weeklyPercent: Number((weeklyKg / valid[0].weightKg * 100).toFixed(2)), days };
}

export function weightTrendAdvice(trend: WeightTrend | null, goalType: NutritionGoalType) {
  if (!trend) return "Haftalık eğilimi görebilmek için en az 5 gün arayla iki kilo ölçümü ekle.";
  const rate = trend.weeklyPercent;
  if (goalType === "lose") {
    if (rate < -1) return "Kilo düşüşü haftada %1'in üzerinde görünüyor. Hedef fazla agresif olabilir; kalori açığını küçültmeyi değerlendir.";
    if (rate >= 0) return "Bu dönemde kilo düşüşü görünmüyor. Tek haftaya göre keskin değişiklik yapmadan kayıt düzenini ve porsiyonları gözden geçir.";
    return "Haftalık kilo değişimi makul aralıkta görünüyor. Günlük dalgalanmalar yerine birkaç haftalık eğilimi izlemeyi sürdür.";
  }
  if (goalType === "gain") {
    if (rate > 0.75) return "Haftalık artış hızlı görünüyor. Kalori fazlasını küçültmek daha kontrollü ilerlemeye yardımcı olabilir.";
    if (rate <= 0) return "Kilo artışı görünmüyor. Antrenman performansı ve birkaç haftalık ortalama da sabitse küçük bir kalori artışı düşünülebilir.";
    return "Haftalık artış kontrollü görünüyor. Güç performansı ve bel ölçümüyle birlikte takip etmeyi sürdür.";
  }
  if (Math.abs(rate) > 0.5) return "Koruma hedefinde haftalık değişim belirgin. Öğün düzenini ve ortalama kalori alımını gözden geçir.";
  return "Kilon koruma hedefiyle uyumlu, dar bir aralıkta ilerliyor.";
}
