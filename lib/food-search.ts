export type FoodMicronutrients = {
  // Şeker gram ölçeğindedir; diğer mikro besinler miligramdır.
  sugarG?: number;
  sodiumMg?: number;
  calciumMg?: number;
  ironMg?: number;
  potassiumMg?: number;
  vitaminCMg?: number;
};

export type FoodNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  micros: FoodMicronutrients;
};

export const emptyFoodNutrition = (): FoodNutrition => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  micros: {},
});

function rounded(value: number, digits = 1) {
  const multiplier = 10 ** digits;
  return Math.round(Math.max(0, Number.isFinite(value) ? value : 0) * multiplier) / multiplier;
}

export function scaleFoodNutrition(nutrition: FoodNutrition, grams: number): FoodNutrition {
  const factor = Math.max(0, Number.isFinite(grams) ? grams : 0) / 100;
  return {
    calories: Math.round(nutrition.calories * factor),
    protein: rounded(nutrition.protein * factor),
    carbs: rounded(nutrition.carbs * factor),
    fat: rounded(nutrition.fat * factor),
    fiber: rounded(nutrition.fiber * factor),
    micros: Object.fromEntries(
      Object.entries(nutrition.micros).map(([key, value]) => [key, rounded((value || 0) * factor)]),
    ) as FoodMicronutrients,
  };
}
