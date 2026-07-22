export type FoodMicronutrients = {
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

export type FoodSearchResult = {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  servingGrams?: number;
  nutritionPer100g: FoodNutrition;
  source: "Open Food Facts" | "FİT.AI temel besin listesi";
};

const emptyMicros = (): FoodMicronutrients => ({});

export const emptyFoodNutrition = (): FoodNutrition => ({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, micros: emptyMicros() });

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
    micros: Object.fromEntries(Object.entries(nutrition.micros).map(([key, value]) => [key, rounded((value || 0) * factor)])) as FoodMicronutrients,
  };
}

export function normalizeFoodSearchText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const staples: FoodSearchResult[] = [
  { id: "tr-yogurt", name: "Yoğurt, sade", servingGrams: 200, nutritionPer100g: { calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3, fiber: 0, micros: { calciumMg: 121, potassiumMg: 155, sodiumMg: 46 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-oats", name: "Yulaf ezmesi", servingGrams: 50, nutritionPer100g: { calories: 379, protein: 13.2, carbs: 67.7, fat: 6.5, fiber: 10.1, micros: { ironMg: 4.7, potassiumMg: 429, calciumMg: 52 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-chicken", name: "Tavuk göğsü, pişmiş", servingGrams: 150, nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, micros: { potassiumMg: 256, sodiumMg: 74, ironMg: 1 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-rice", name: "Pirinç pilavı, pişmiş", servingGrams: 180, nutritionPer100g: { calories: 130, protein: 2.4, carbs: 28.2, fat: 0.3, fiber: 0.4, micros: { potassiumMg: 35, sodiumMg: 1 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-bulgur", name: "Bulgur, pişmiş", servingGrams: 180, nutritionPer100g: { calories: 83, protein: 3.1, carbs: 18.6, fat: 0.2, fiber: 4.5, micros: { ironMg: 1, potassiumMg: 68 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-eggs", name: "Yumurta, haşlanmış", servingGrams: 50, nutritionPer100g: { calories: 155, protein: 12.6, carbs: 1.1, fat: 10.6, fiber: 0, micros: { ironMg: 1.2, calciumMg: 50, potassiumMg: 126, sodiumMg: 124 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-banana", name: "Muz", servingGrams: 120, nutritionPer100g: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, micros: { potassiumMg: 358, vitaminCMg: 8.7 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-lentil", name: "Mercimek çorbası", servingGrams: 250, nutritionPer100g: { calories: 68, protein: 4.5, carbs: 10.5, fat: 1.1, fiber: 3.4, micros: { ironMg: 1.8, potassiumMg: 180 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-salmon", name: "Somon, pişmiş", servingGrams: 150, nutritionPer100g: { calories: 206, protein: 22, carbs: 0, fat: 12.4, fiber: 0, micros: { potassiumMg: 384, sodiumMg: 59, ironMg: 0.5 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-chickpeas", name: "Nohut, haşlanmış", servingGrams: 180, nutritionPer100g: { calories: 164, protein: 8.9, carbs: 27.4, fat: 2.6, fiber: 7.6, micros: { ironMg: 2.9, potassiumMg: 291, calciumMg: 49 } }, source: "FİT.AI temel besin listesi" },
];

export function searchLocalFoods(query: string, limit = 6) {
  const normalizedQuery = normalizeFoodSearchText(query);
  if (normalizedQuery.length < 2) return [];
  const terms = normalizedQuery.split(" ");
  return staples.filter((food) => {
    const searchable = normalizeFoodSearchText(food.name);
    return terms.every((term) => searchable.includes(term));
  }).slice(0, limit);
}

export function mergeFoodResults(local: FoodSearchResult[], remote: FoodSearchResult[], limit = 8) {
  const unique = new Map<string, FoodSearchResult>();
  [...remote, ...local].forEach((food) => {
    const key = `${normalizeFoodSearchText(food.name)}-${food.barcode || ""}`;
    if (!unique.has(key)) unique.set(key, food);
  });
  return [...unique.values()].slice(0, limit);
}
