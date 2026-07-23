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

export type OpenFoodFactsSearchHit = {
  code?: string;
  product_name?: string;
  product_name_tr?: string;
  brands?: string[] | string;
  serving_size?: string;
  nutriments?: Record<string, unknown>;
};

const emptyMicros = (): FoodMicronutrients => ({});

export const emptyFoodNutrition = (): FoodNutrition => ({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, micros: emptyMicros() });

function rounded(value: number, digits = 1) {
  const multiplier = 10 ** digits;
  return Math.round(Math.max(0, Number.isFinite(value) ? value : 0) * multiplier) / multiplier;
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function micronutrientMilligrams(nutrients: Record<string, unknown>, name: string) {
  const amount = numeric(nutrients[`${name}_100g`]);
  const unit = String(nutrients[`${name}_unit`] || "g").toLowerCase();
  if (!amount) return 0;
  if (unit === "mg") return amount;
  if (unit === "µg" || unit === "ug") return amount / 1_000;
  return amount * 1_000;
}

function parseServingGrams(value: string | undefined) {
  const match = value?.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*g\b/i);
  const grams = match ? Number(match[1]) : 100;
  return Number.isFinite(grams) && grams > 0 && grams <= 2_000 ? grams : 100;
}

export function openFoodFactsHitToFood(hit: OpenFoodFactsSearchHit): FoodSearchResult | null {
  const nutrients = hit.nutriments || {};
  const name = hit.product_name_tr || hit.product_name;
  const calories = Math.round(numeric(nutrients["energy-kcal_100g"]));
  if (!name || !calories) return null;

  const micros: FoodMicronutrients = {};
  const sodium = micronutrientMilligrams(nutrients, "sodium");
  const calcium = micronutrientMilligrams(nutrients, "calcium");
  const iron = micronutrientMilligrams(nutrients, "iron");
  const potassium = micronutrientMilligrams(nutrients, "potassium");
  const vitaminC = micronutrientMilligrams(nutrients, "vitamin-c");
  if (sodium) micros.sodiumMg = rounded(sodium);
  if (calcium) micros.calciumMg = rounded(calcium);
  if (iron) micros.ironMg = rounded(iron);
  if (potassium) micros.potassiumMg = rounded(potassium);
  if (vitaminC) micros.vitaminCMg = rounded(vitaminC);

  const brands = Array.isArray(hit.brands) ? hit.brands : hit.brands?.split(",");
  const brand = brands?.map((item) => item.trim()).filter(Boolean).join(", ");
  return {
    id: `off-${hit.code || normalizeFoodSearchText(name)}`,
    name,
    brand: brand || undefined,
    barcode: hit.code || undefined,
    servingGrams: parseServingGrams(hit.serving_size),
    nutritionPer100g: {
      calories,
      protein: rounded(numeric(nutrients.proteins_100g)),
      carbs: rounded(numeric(nutrients.carbohydrates_100g)),
      fat: rounded(numeric(nutrients.fat_100g)),
      fiber: rounded(numeric(nutrients.fiber_100g)),
      micros,
    },
    source: "Open Food Facts",
  };
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
  { id: "tr-white-bread", name: "Beyaz ekmek", servingGrams: 50, nutritionPer100g: { calories: 265, protein: 9, carbs: 49, fat: 3.2, fiber: 2.7, micros: { sodiumMg: 491, calciumMg: 260, ironMg: 3.6 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-whole-bread", name: "Tam buğday ekmeği", servingGrams: 50, nutritionPer100g: { calories: 247, protein: 13, carbs: 41, fat: 3.4, fiber: 6.8, micros: { sodiumMg: 400, ironMg: 2.5 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-simit", name: "Simit", servingGrams: 100, nutritionPer100g: { calories: 330, protein: 10, carbs: 57, fat: 7, fiber: 3, micros: { sodiumMg: 560, calciumMg: 110 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-toast", name: "Kaşarlı tost", servingGrams: 180, nutritionPer100g: { calories: 270, protein: 12, carbs: 29, fat: 12, fiber: 1.6, micros: { calciumMg: 220, sodiumMg: 510 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-milk", name: "Süt, yarım yağlı", servingGrams: 200, nutritionPer100g: { calories: 50, protein: 3.4, carbs: 4.8, fat: 1.8, fiber: 0, micros: { calciumMg: 120, potassiumMg: 150 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-ayran", name: "Ayran", servingGrams: 250, nutritionPer100g: { calories: 37, protein: 2, carbs: 2.7, fat: 2, fiber: 0, micros: { calciumMg: 80, sodiumMg: 120 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-feta", name: "Beyaz peynir", servingGrams: 40, nutritionPer100g: { calories: 264, protein: 14, carbs: 4, fat: 21, fiber: 0, micros: { calciumMg: 493, sodiumMg: 917 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-kasar", name: "Kaşar peyniri", servingGrams: 30, nutritionPer100g: { calories: 404, protein: 25, carbs: 3, fat: 33, fiber: 0, micros: { calciumMg: 700, sodiumMg: 620 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-menemen", name: "Menemen", servingGrams: 220, nutritionPer100g: { calories: 105, protein: 5.2, carbs: 4.5, fat: 7.3, fiber: 1.2, micros: { potassiumMg: 210, vitaminCMg: 18 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-omelette", name: "Sade omlet", servingGrams: 120, nutritionPer100g: { calories: 154, protein: 11, carbs: 1.2, fat: 12, fiber: 0, micros: { ironMg: 1.5, calciumMg: 60 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-tarhana", name: "Tarhana çorbası", servingGrams: 250, nutritionPer100g: { calories: 57, protein: 2.2, carbs: 8.5, fat: 1.6, fiber: 1, micros: { sodiumMg: 190, calciumMg: 32 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-ezogelin", name: "Ezogelin çorbası", servingGrams: 250, nutritionPer100g: { calories: 62, protein: 3.1, carbs: 9.5, fat: 1.4, fiber: 2.2, micros: { ironMg: 1.1, potassiumMg: 150 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-chicken-soup", name: "Tavuk çorbası", servingGrams: 250, nutritionPer100g: { calories: 49, protein: 4, carbs: 4.5, fat: 1.8, fiber: 0.5, micros: { sodiumMg: 180, potassiumMg: 120 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-beans", name: "Kuru fasulye yemeği", servingGrams: 220, nutritionPer100g: { calories: 126, protein: 6.2, carbs: 18, fat: 3.4, fiber: 5.5, micros: { ironMg: 2.1, potassiumMg: 320 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-green-lentil", name: "Yeşil mercimek yemeği", servingGrams: 220, nutritionPer100g: { calories: 116, protein: 7.5, carbs: 17, fat: 2.2, fiber: 6.2, micros: { ironMg: 2.8, potassiumMg: 310 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-pasta", name: "Sade makarna, pişmiş", servingGrams: 180, nutritionPer100g: { calories: 158, protein: 5.8, carbs: 30.9, fat: 0.9, fiber: 1.8, micros: { ironMg: 1.3, potassiumMg: 44 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-tomato-pasta", name: "Domates soslu makarna", servingGrams: 220, nutritionPer100g: { calories: 145, protein: 4.8, carbs: 25, fat: 3.2, fiber: 2, micros: { potassiumMg: 160, vitaminCMg: 6 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-meatball", name: "Izgara köfte", servingGrams: 150, nutritionPer100g: { calories: 240, protein: 23, carbs: 4, fat: 15, fiber: 0.4, micros: { ironMg: 2.4, potassiumMg: 300 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-chicken-grill", name: "Izgara tavuk", servingGrams: 150, nutritionPer100g: { calories: 172, protein: 30, carbs: 1, fat: 5, fiber: 0, micros: { potassiumMg: 260, sodiumMg: 80 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-doner", name: "Tavuk döner", servingGrams: 150, nutritionPer100g: { calories: 215, protein: 22, carbs: 5, fat: 12, fiber: 0.5, micros: { sodiumMg: 520, ironMg: 1.4 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-lahmacun", name: "Lahmacun", servingGrams: 150, nutritionPer100g: { calories: 190, protein: 9, carbs: 25, fat: 6, fiber: 2.2, micros: { sodiumMg: 430, ironMg: 1.8 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-pide", name: "Kıymalı pide", servingGrams: 250, nutritionPer100g: { calories: 245, protein: 11, carbs: 31, fat: 8.5, fiber: 1.8, micros: { sodiumMg: 490, ironMg: 2 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-manti", name: "Mantı, yoğurtlu", servingGrams: 250, nutritionPer100g: { calories: 195, protein: 9.5, carbs: 26, fat: 6, fiber: 1.4, micros: { calciumMg: 75, sodiumMg: 310 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-borek", name: "Peynirli börek", servingGrams: 150, nutritionPer100g: { calories: 285, protein: 9, carbs: 30, fat: 14, fiber: 1.5, micros: { calciumMg: 140, sodiumMg: 460 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-potato", name: "Haşlanmış patates", servingGrams: 180, nutritionPer100g: { calories: 87, protein: 1.9, carbs: 20, fat: 0.1, fiber: 1.8, micros: { potassiumMg: 379, vitaminCMg: 13 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-mashed-potato", name: "Patates püresi", servingGrams: 180, nutritionPer100g: { calories: 113, protein: 2, carbs: 17, fat: 4.2, fiber: 1.5, micros: { potassiumMg: 285, calciumMg: 34 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-salad", name: "Mevsim salata", servingGrams: 200, nutritionPer100g: { calories: 45, protein: 1.4, carbs: 5, fat: 2.5, fiber: 2, micros: { potassiumMg: 210, vitaminCMg: 22 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-olive-oil-salad", name: "Zeytinyağlı salata", servingGrams: 200, nutritionPer100g: { calories: 85, protein: 1.3, carbs: 5, fat: 7, fiber: 2.1, micros: { potassiumMg: 220, vitaminCMg: 20 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-apple", name: "Elma", servingGrams: 180, nutritionPer100g: { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, micros: { potassiumMg: 107, vitaminCMg: 4.6 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-orange", name: "Portakal", servingGrams: 180, nutritionPer100g: { calories: 47, protein: 0.9, carbs: 11.8, fat: 0.1, fiber: 2.4, micros: { potassiumMg: 181, vitaminCMg: 53 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-almond", name: "Badem", servingGrams: 30, nutritionPer100g: { calories: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5, micros: { calciumMg: 269, ironMg: 3.7, potassiumMg: 733 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-walnut", name: "Ceviz", servingGrams: 30, nutritionPer100g: { calories: 654, protein: 15, carbs: 14, fat: 65, fiber: 6.7, micros: { calciumMg: 98, potassiumMg: 441 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-tuna", name: "Ton balığı, süzülmüş", servingGrams: 120, nutritionPer100g: { calories: 132, protein: 29, carbs: 0, fat: 1.3, fiber: 0, micros: { sodiumMg: 300, potassiumMg: 237 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-cacik", name: "Cacık", servingGrams: 200, nutritionPer100g: { calories: 50, protein: 2.6, carbs: 4, fat: 2.7, fiber: 0.4, micros: { calciumMg: 95, potassiumMg: 150 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-snickers", name: "Snickers", brand: "Mars", servingGrams: 50, nutritionPer100g: { calories: 510, protein: 9.5, carbs: 54, fat: 28, fiber: 2.5, micros: { sodiumMg: 176 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-mars", name: "Mars çikolata bar", brand: "Mars", servingGrams: 51, nutritionPer100g: { calories: 449, protein: 4.3, carbs: 70, fat: 17, fiber: 1.2, micros: { sodiumMg: 170 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-twix", name: "Twix çikolata bar", brand: "Mars", servingGrams: 50, nutritionPer100g: { calories: 493, protein: 4.9, carbs: 65, fat: 24, fiber: 1.5, micros: { sodiumMg: 210 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-kitkat", name: "KitKat sütlü çikolatalı gofret", brand: "Nestlé", servingGrams: 41.5, nutritionPer100g: { calories: 518, protein: 6.5, carbs: 64, fat: 26, fiber: 2.3, micros: { sodiumMg: 125 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-kinder-bueno", name: "Kinder Bueno", brand: "Ferrero", servingGrams: 43, nutritionPer100g: { calories: 572, protein: 8.6, carbs: 49.5, fat: 37.3, fiber: 3, micros: { sodiumMg: 107 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-ulker-wafer", name: "Ülker Çikolatalı Gofret", brand: "Ülker", servingGrams: 36, nutritionPer100g: { calories: 544, protein: 6.7, carbs: 61, fat: 30, fiber: 2.5, micros: { sodiumMg: 130 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-eti-browni", name: "Eti Browni Intense", brand: "Eti", servingGrams: 50, nutritionPer100g: { calories: 430, protein: 5.5, carbs: 55, fat: 21, fiber: 3.2, micros: { sodiumMg: 210 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-biskrem", name: "Biskrem kakaolu bisküvi", brand: "Ülker", servingGrams: 50, nutritionPer100g: { calories: 480, protein: 6.5, carbs: 66, fat: 21, fiber: 2.6, micros: { sodiumMg: 280 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-oreo", name: "Oreo kakaolu bisküvi", brand: "Oreo", servingGrams: 44, nutritionPer100g: { calories: 474, protein: 5, carbs: 70, fat: 20, fiber: 2.5, micros: { sodiumMg: 460 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-lays", name: "Lay's klasik patates cipsi", brand: "Lay's", servingGrams: 30, nutritionPer100g: { calories: 536, protein: 6.5, carbs: 53, fat: 34, fiber: 4.5, micros: { sodiumMg: 520, potassiumMg: 1200 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-doritos", name: "Doritos nacho mısır cipsi", brand: "Doritos", servingGrams: 30, nutritionPer100g: { calories: 500, protein: 7, carbs: 57, fat: 27, fiber: 4.5, micros: { sodiumMg: 650 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-cheetos", name: "Cheetos peynir aromalı mısır çerezi", brand: "Cheetos", servingGrams: 30, nutritionPer100g: { calories: 535, protein: 6, carbs: 55, fat: 32, fiber: 2.5, micros: { sodiumMg: 700 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-haribo", name: "Haribo ayıcık jelibon", brand: "Haribo", servingGrams: 30, nutritionPer100g: { calories: 343, protein: 6.9, carbs: 77, fat: 0.5, fiber: 0, micros: { sodiumMg: 10 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-protein-bar", name: "Protein bar, çikolatalı", servingGrams: 50, nutritionPer100g: { calories: 380, protein: 30, carbs: 36, fat: 12, fiber: 8, micros: { sodiumMg: 280, calciumMg: 140 } }, source: "FİT.AI temel besin listesi" },
];

export function searchLocalFoods(query: string, limit = 6) {
  const normalizedQuery = normalizeFoodSearchText(query);
  if (normalizedQuery.length < 2) return [];
  const terms = normalizedQuery.split(" ");
  return staples.filter((food) => {
    const searchable = normalizeFoodSearchText(`${food.name} ${food.brand || ""}`);
    return terms.every((term) => {
      const alternatives = term.endsWith("k") ? [term, `${term.slice(0, -1)}g`] : [term];
      return alternatives.some((candidate) => searchable.includes(candidate));
    });
  }).slice(0, limit);
}

export function mergeFoodResults(local: FoodSearchResult[], remote: FoodSearchResult[], limit = 8) {
  const unique = new Map<string, FoodSearchResult>();
  [...local, ...remote].forEach((food) => {
    const key = `${normalizeFoodSearchText(food.name)}-${food.barcode || ""}`;
    if (!unique.has(key)) unique.set(key, food);
  });
  return [...unique.values()].slice(0, limit);
}
