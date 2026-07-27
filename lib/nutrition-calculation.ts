import type { FoodNutrition, PortionNutrition } from "./nutrition-model.ts";

export const MAX_PORTION_GRAMS = 5_000;

function assertFiniteNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be a finite, non-negative number`);
}

function rounded(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function valueForPortion(valuePer100g: number, portionGrams: number, digits = 1) {
  assertFiniteNonNegative(valuePer100g, "valuePer100g");
  if (!Number.isFinite(portionGrams) || portionGrams <= 0 || portionGrams > MAX_PORTION_GRAMS) {
    throw new RangeError(`portionGrams must be between 0 and ${MAX_PORTION_GRAMS}`);
  }
  return rounded(valuePer100g * portionGrams / 100, digits);
}

export function calculatePortionNutrition(food: Pick<FoodNutrition,
  "caloriesPer100g" | "proteinPer100g" | "carbohydratesPer100g" | "fatPer100g" | "fiberPer100g"
>, portionGrams: number): PortionNutrition {
  return {
    calories: valueForPortion(food.caloriesPer100g, portionGrams, 0),
    protein: valueForPortion(food.proteinPer100g, portionGrams),
    carbohydrates: valueForPortion(food.carbohydratesPer100g, portionGrams),
    fat: valueForPortion(food.fatPer100g, portionGrams),
    fiber: valueForPortion(food.fiberPer100g, portionGrams),
  };
}

export function validateManualNutrition(input: PortionNutrition & { portionGrams: number }) {
  if (!Number.isFinite(input.portionGrams) || input.portionGrams <= 0 || input.portionGrams > MAX_PORTION_GRAMS) {
    return { valid: false, warning: null, error: `Porsiyon 0 ile ${MAX_PORTION_GRAMS} gram arasında olmalı.` };
  }
  const nutrientValues = [input.calories, input.protein, input.carbohydrates, input.fat, input.fiber];
  if (nutrientValues.some((value) => !Number.isFinite(value) || value < 0 || value > 20_000)) {
    return { valid: false, warning: null, error: "Besin değerleri geçerli, negatif olmayan sayılar olmalı." };
  }
  if (input.calories <= 0) return { valid: false, warning: null, error: "Kalori 0'dan büyük olmalı." };
  const calculatedCalories = input.protein * 4 + input.carbohydrates * 4 + input.fat * 9;
  const difference = Math.abs(calculatedCalories - input.calories);
  const tolerance = Math.max(80, input.calories * 0.35);
  return {
    valid: true,
    error: null,
    warning: difference > tolerance
      ? `Girilen makrolar yaklaşık ${Math.round(calculatedCalories)} kcal ediyor; etiket kalorisini kontrol et.`
      : null,
  };
}
