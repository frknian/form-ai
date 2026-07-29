import { scaleFoodNutrition, type FoodSearchResult } from "./food-search.ts";
import { searchFoodCatalog } from "./nutrition-data.ts";
import type { PortionNutrition } from "./nutrition-model.ts";
import type { ParsedMeal, ParsedMealItem } from "./nutrition-parser.ts";

export type ResolvedMealItem = ParsedMealItem & {
  food: FoodSearchResult | null;
  nutrition: PortionNutrition | null;
  isEstimated: boolean;
  matchKind: "exact" | "approximate" | "unmatched";
};

const PREPARATION_TERMS = new Set([
  "firin", "firinda", "firinlanmis", "haslama", "haslanmis", "izgara", "izgarada",
  "kizartma", "kizartilmis", "sotelenmis", "sote", "pisirilmis", "pismis", "yemegi",
]);

function withoutPreparation(query: string) {
  return query
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((term) => term && !PREPARATION_TERMS.has(
      term.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/ı/g, "i"),
    ))
    .join(" ")
    .trim();
}

async function firstMatch(request: Request, query: string) {
  const result = await searchFoodCatalog(request, query, 5);
  return result.results.find((food) => food.nutritionPer100g) || result.results[0] || null;
}

type SearchFirst = (request: Request, query: string) => Promise<FoodSearchResult | null>;

export async function resolveMealItem(
  request: Request,
  item: ParsedMealItem,
  searchFirst: SearchFirst = firstMatch,
): Promise<ResolvedMealItem> {
  let match = await searchFirst(request, item.query);
  let matchKind: ResolvedMealItem["matchKind"] = match ? "exact" : "unmatched";
  if (!match) {
    const simplified = withoutPreparation(item.query);
    if (simplified.length >= 2 && simplified !== item.query.toLocaleLowerCase("tr-TR")) {
      match = await searchFirst(request, simplified);
      if (match) matchKind = "approximate";
    }
  }
  if (!match) {
    return { ...item, food: null, nutrition: null, isEstimated: true, matchKind: "unmatched" };
  }
  if (!match.nutritionPer100g) {
    return {
      ...item,
      food: match,
      nutrition: null,
      isEstimated: true,
      needsConfirmation: true,
      matchKind,
    };
  }
  const scaled = scaleFoodNutrition(match.nutritionPer100g, item.estimatedGrams);
  return {
    ...item,
    confidence: matchKind === "approximate" ? Math.min(item.confidence, 0.55) : item.confidence,
    needsConfirmation: item.needsConfirmation || matchKind === "approximate",
    food: match,
    nutrition: {
      calories: scaled.calories,
      protein: scaled.protein,
      carbohydrates: scaled.carbs,
      fat: scaled.fat,
      fiber: scaled.fiber,
    },
    isEstimated: item.needsConfirmation || matchKind === "approximate",
    matchKind,
  };
}

export async function resolveParsedMeal(request: Request, meal: ParsedMeal, searchFirst: SearchFirst = firstMatch) {
  const items = await Promise.all(meal.items.map((item) => resolveMealItem(request, item, searchFirst)));
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
      ...(items.some((item) => item.matchKind === "approximate") ? ["Bazı besinler hazırlanma biçimi çıkarılarak en yakın katalog kaydıyla yaklaşık eşleştirildi."] : []),
      ...(items.some((item) => !item.food) ? ["Bazı besinler katalogda bulunamadı; değerlerini elle tamamlayın."] : []),
      ...(items.some((item) => item.food && !item.nutrition) ? ["Bazı katalog eşleşmelerinin besin hesabı inceleme bekliyor; doğrulanmadan öğüne eklenemez."] : []),
    ],
  };
}
