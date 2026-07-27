import { searchLocalFoods } from "./food-search.ts";
import { calculatePortionNutrition } from "./nutrition-calculation.ts";
import { mapLocalFood, type FoodNutrition, type PortionNutrition } from "./nutrition-model.ts";
import type { ParsedMeal, ParsedMealItem } from "./nutrition-parser.ts";

export type ResolvedMealItem = ParsedMealItem & {
  food: FoodNutrition | null;
  nutrition: PortionNutrition | null;
  isEstimated: boolean;
};

export function resolveMealItem(item: ParsedMealItem): ResolvedMealItem {
  const match = searchLocalFoods(item.query, 1)[0];
  if (!match) return { ...item, food: null, nutrition: null, isEstimated: true };
  const food = mapLocalFood(match);
  return {
    ...item,
    food,
    nutrition: calculatePortionNutrition(food, item.estimatedGrams),
    isEstimated: item.needsConfirmation || food.dataQuality === "estimated",
  };
}

export function resolveParsedMeal(meal: ParsedMeal) {
  const items = meal.items.map(resolveMealItem);
  const totals = items.reduce<PortionNutrition>((sum, item) => ({
    calories: sum.calories + (item.nutrition?.calories || 0),
    protein: sum.protein + (item.nutrition?.protein || 0),
    carbohydrates: sum.carbohydrates + (item.nutrition?.carbohydrates || 0),
    fat: sum.fat + (item.nutrition?.fat || 0),
    fiber: sum.fiber + (item.nutrition?.fiber || 0),
  }), { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 });
  return {
    items,
    totals: {
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein * 10) / 10,
      carbohydrates: Math.round(totals.carbohydrates * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
      fiber: Math.round(totals.fiber * 10) / 10,
    },
    warnings: [
      ...meal.warnings,
      ...(items.some((item) => !item.food) ? ["Bazı besinler doğrulanmış katalogda bulunamadı; değerlerini elle tamamlayın."] : []),
    ],
  };
}
