export type NutritionAdviceInput = {
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  totals: { calories: number; protein: number; carbs: number; fat: number };
  meals: Array<{ name: string; meal: string; calories: number; protein: number; carbs: number; fat: number }>;
};

function gap(target: number, current: number) {
  return Math.max(0, Math.round(target - current));
}

export function localNutritionAdvice(input: NutritionAdviceInput) {
  if (!input.meals.length) return "İlk öğününde protein kaynağı, sebze veya meyve ve ihtiyacına uygun bir karbonhidratı birlikte düşün. Porsiyonu açlık durumuna göre ayarla.";
  const proteinGap = gap(input.proteinTarget, input.totals.protein);
  const carbsGap = gap(input.carbsTarget, input.totals.carbs);
  const fatGap = gap(input.fatTarget, input.totals.fat);
  const calorieGap = gap(input.calorieTarget, input.totals.calories);
  if (!calorieGap) return "Günlük enerji hedefin doldu. Sonraki seçiminde açlık durumunu izle; gerekirse sebze, yoğurt veya meyve gibi sade bir seçenek tercih et.";
  if (proteinGap >= Math.max(15, carbsGap * 0.45)) return `Protein hedefinde yaklaşık ${proteinGap} g alan var. Sonraki öğünde yoğurt, yumurta, tavuk, balık veya bakliyat gibi bir protein kaynağını sebzeyle eşleştirebilirsin.`;
  if (carbsGap > 35) return `Karbonhidrat hedefinde yaklaşık ${carbsGap} g alan var. Bulgur, yulaf, patates, tam tahıllı ekmek veya meyveden ihtiyacına uygun bir porsiyon ekleyebilirsin.`;
  if (fatGap > 12) return "Sonraki öğünde zeytinyağı, ceviz veya avokado gibi doymamış yağ kaynaklarından küçük bir porsiyon düşünebilirsin.";
  return `Yaklaşık ${calorieGap} kcal alanın kaldı. Protein, lifli sebze ve ölçülü bir karbonhidrat içeren dengeli bir öğün hedefe yaklaşmanı kolaylaştırabilir.`;
}
