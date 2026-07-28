import { searchLocalFoods } from "./food-search.ts";
import { calculatePortionNutrition } from "./nutrition-calculation.ts";
import { mapLocalFood, type FoodNutrition, type PortionNutrition } from "./nutrition-model.ts";
import type { ParsedMeal, ParsedMealItem } from "./nutrition-parser.ts";

export type ResolvedMealItem = ParsedMealItem & {
  food: FoodNutrition | null;
  nutrition: PortionNutrition | null;
  isEstimated: boolean;
  matchKind: "exact" | "approximate" | "unmatched";
};

const PREPARATION_TERMS = new Set([
  "firin",
  "firinda",
  "firinlanmis",
  "haslama",
  "haslanmis",
  "izgara",
  "izgarada",
  "kizartma",
  "kizartilmis",
  "sotelenmis",
  "sote",
  "pisirilmis",
  "pismis",
  "yemegi",
]);

function searchWithoutPreparation(query: string) {
  const simplified = query
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((term) => term && !PREPARATION_TERMS.has(
      term.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/ı/g, "i"),
    ))
    .join(" ");
  if (simplified.length < 2 || simplified.toLocaleLowerCase("tr-TR") === query.trim().toLocaleLowerCase("tr-TR")) return null;
  return searchLocalFoods(simplified, 1)[0] || null;
}

export function resolveMealItem(item: ParsedMealItem): ResolvedMealItem {
  const exactMatch = searchLocalFoods(item.query, 1)[0];
  const match = exactMatch || searchWithoutPreparation(item.query);
  if (!match) return { ...item, food: null, nutrition: null, isEstimated: true, matchKind: "unmatched" };
  const matchKind = exactMatch ? "exact" : "approximate";
  const food = mapLocalFood(match);
  return {
    ...item,
    confidence: matchKind === "approximate" ? Math.min(item.confidence, 0.55) : item.confidence,
    needsConfirmation: item.needsConfirmation || matchKind === "approximate",
    food,
    nutrition: calculatePortionNutrition(food, item.estimatedGrams),
    isEstimated: item.needsConfirmation || matchKind === "approximate" || food.dataQuality === "estimated",
    matchKind,
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
      ...(items.some((item) => item.matchKind === "approximate") ? ["Bazı besinler hazırlanma biçimi çıkarılarak en yakın katalog kaydıyla yaklaşık hesaplandı."] : []),
      ...(items.some((item) => !item.food) ? ["Bazı besinler doğrulanmış katalogda bulunamadı; değerlerini elle tamamlayın."] : []),
    ],
  };
}
