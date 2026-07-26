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
  { id: "tr-iskender", name: "İskender kebap", servingGrams: 300, nutritionPer100g: { calories: 215, protein: 14, carbs: 16, fat: 11, fiber: 1.2, micros: { sodiumMg: 520, ironMg: 2.1 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-adana", name: "Adana kebap", servingGrams: 180, nutritionPer100g: { calories: 255, protein: 18, carbs: 2, fat: 20, fiber: 0.5, micros: { sodiumMg: 480, ironMg: 2.4 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-urfa", name: "Urfa kebap", servingGrams: 180, nutritionPer100g: { calories: 240, protein: 18.5, carbs: 2, fat: 18, fiber: 0.5, micros: { sodiumMg: 460, ironMg: 2.3 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-beyti", name: "Beyti kebap", servingGrams: 250, nutritionPer100g: { calories: 268, protein: 17, carbs: 14, fat: 17, fiber: 1, micros: { sodiumMg: 540 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-tavuk-sis", name: "Tavuk şiş", servingGrams: 180, nutritionPer100g: { calories: 175, protein: 26, carbs: 1.5, fat: 7, fiber: 0.2, micros: { sodiumMg: 320, potassiumMg: 290 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-et-sis", name: "Et şiş", servingGrams: 180, nutritionPer100g: { calories: 215, protein: 27, carbs: 1, fat: 12, fiber: 0.2, micros: { ironMg: 2.8, sodiumMg: 300 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-cig-kofte", name: "Çiğ köfte", servingGrams: 120, nutritionPer100g: { calories: 180, protein: 5, carbs: 32, fat: 3.5, fiber: 4.5, micros: { ironMg: 2.5, sodiumMg: 390 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-karniyarik", name: "Karnıyarık", servingGrams: 250, nutritionPer100g: { calories: 135, protein: 6.5, carbs: 9, fat: 8, fiber: 3.2, micros: { potassiumMg: 320 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-imambayildi", name: "İmambayıldı", servingGrams: 220, nutritionPer100g: { calories: 120, protein: 2, carbs: 10, fat: 8.5, fiber: 3.8, micros: { potassiumMg: 300 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-musakka", name: "Musakka", servingGrams: 250, nutritionPer100g: { calories: 145, protein: 7.5, carbs: 8, fat: 9.5, fiber: 2.6, micros: { sodiumMg: 330 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-dolma", name: "Zeytinyağlı yaprak sarma", servingGrams: 150, nutritionPer100g: { calories: 180, protein: 3, carbs: 22, fat: 9, fiber: 3, micros: { sodiumMg: 420 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-biber-dolma", name: "Etli biber dolma", servingGrams: 220, nutritionPer100g: { calories: 125, protein: 5.5, carbs: 13, fat: 6, fiber: 2.4, micros: { potassiumMg: 270 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-guvec", name: "Etli güveç", servingGrams: 280, nutritionPer100g: { calories: 118, protein: 9, carbs: 8, fat: 5.5, fiber: 2, micros: { ironMg: 1.6 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-tas-kebap", name: "Tas kebabı", servingGrams: 250, nutritionPer100g: { calories: 145, protein: 12, carbs: 7, fat: 7.5, fiber: 1.4, micros: { ironMg: 2 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-sac-kavurma", name: "Saç kavurma", servingGrams: 200, nutritionPer100g: { calories: 205, protein: 20, carbs: 4, fat: 12, fiber: 1, micros: { ironMg: 2.6 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-hunkar", name: "Hünkar beğendi", servingGrams: 280, nutritionPer100g: { calories: 160, protein: 10, carbs: 10, fat: 9, fiber: 2.2, micros: { calciumMg: 90 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-kuru-kofte", name: "Kuru köfte", servingGrams: 150, nutritionPer100g: { calories: 265, protein: 17, carbs: 8, fat: 19, fiber: 0.8, micros: { ironMg: 2.1 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-etli-nohut", name: "Etli nohut yemeği", servingGrams: 250, nutritionPer100g: { calories: 125, protein: 7, carbs: 14, fat: 4.5, fiber: 4.2, micros: { ironMg: 1.9 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-taze-fasulye", name: "Zeytinyağlı taze fasulye", servingGrams: 220, nutritionPer100g: { calories: 75, protein: 2, carbs: 8, fat: 4, fiber: 3.2, micros: { potassiumMg: 250 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-ispanak", name: "Ispanak yemeği", servingGrams: 220, nutritionPer100g: { calories: 72, protein: 3.5, carbs: 6, fat: 3.8, fiber: 2.8, micros: { ironMg: 2.2, calciumMg: 110 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-pirasa", name: "Zeytinyağlı pırasa", servingGrams: 220, nutritionPer100g: { calories: 88, protein: 2, carbs: 11, fat: 4.2, fiber: 3, micros: { potassiumMg: 230 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-turlu", name: "Sebze türlü", servingGrams: 250, nutritionPer100g: { calories: 68, protein: 2.2, carbs: 9, fat: 2.8, fiber: 2.6, micros: { potassiumMg: 280 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-kuru-dolma", name: "Etli kabak dolma", servingGrams: 220, nutritionPer100g: { calories: 110, protein: 5, carbs: 11, fat: 5.2, fiber: 2.2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-hamsi-tava", name: "Hamsi tava", servingGrams: 150, nutritionPer100g: { calories: 235, protein: 19, carbs: 7, fat: 14, fiber: 0.3, micros: { sodiumMg: 180 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-levrek", name: "Izgara levrek", servingGrams: 180, nutritionPer100g: { calories: 124, protein: 24, carbs: 0, fat: 3, fiber: 0, micros: { potassiumMg: 280 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-somon", name: "Izgara somon", servingGrams: 180, nutritionPer100g: { calories: 208, protein: 22, carbs: 0, fat: 13, fiber: 0, micros: { potassiumMg: 363 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-alabalik", name: "Izgara alabalık", servingGrams: 180, nutritionPer100g: { calories: 148, protein: 21, carbs: 0, fat: 7, fiber: 0, micros: { potassiumMg: 361 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-kokorec", name: "Kokoreç", servingGrams: 150, nutritionPer100g: { calories: 290, protein: 17, carbs: 12, fat: 20, fiber: 0.8, micros: { sodiumMg: 620 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-midye-dolma", name: "Midye dolma", servingGrams: 120, nutritionPer100g: { calories: 155, protein: 6, carbs: 22, fat: 4.5, fiber: 1.2, micros: { ironMg: 3, sodiumMg: 340 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-tantuni", name: "Tantuni", servingGrams: 200, nutritionPer100g: { calories: 215, protein: 14, carbs: 20, fat: 9, fiber: 1.6, micros: { sodiumMg: 510 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-kumpir", name: "Kumpir", servingGrams: 350, nutritionPer100g: { calories: 175, protein: 5, carbs: 22, fat: 7.5, fiber: 2.4, micros: { sodiumMg: 390, potassiumMg: 420 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-etli-ekmek", name: "Etli ekmek", servingGrams: 250, nutritionPer100g: { calories: 255, protein: 12, carbs: 32, fat: 9, fiber: 2, micros: { sodiumMg: 480 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-su-boregi", name: "Su böreği", servingGrams: 180, nutritionPer100g: { calories: 255, protein: 9, carbs: 28, fat: 12, fiber: 1.2, micros: { calciumMg: 140 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-sigara-borek", name: "Sigara böreği", servingGrams: 120, nutritionPer100g: { calories: 320, protein: 9, carbs: 30, fat: 18, fiber: 1.4, micros: { sodiumMg: 420 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-gozleme", name: "Peynirli gözleme", servingGrams: 200, nutritionPer100g: { calories: 245, protein: 9, carbs: 30, fat: 10, fiber: 1.8, micros: { calciumMg: 150 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-pogaca", name: "Peynirli poğaça", servingGrams: 80, nutritionPer100g: { calories: 330, protein: 8, carbs: 36, fat: 17, fiber: 1.5, micros: { sodiumMg: 420 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-acma", name: "Açma", servingGrams: 90, nutritionPer100g: { calories: 340, protein: 8, carbs: 44, fat: 15, fiber: 1.8, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-bazlama", name: "Bazlama", servingGrams: 100, nutritionPer100g: { calories: 270, protein: 7.5, carbs: 52, fat: 3.2, fiber: 2.4, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-yufka", name: "Yufka", servingGrams: 60, nutritionPer100g: { calories: 300, protein: 8.5, carbs: 60, fat: 2.5, fiber: 2.2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-mercimek-kofte", name: "Mercimek köftesi", servingGrams: 120, nutritionPer100g: { calories: 175, protein: 6, carbs: 28, fat: 4.5, fiber: 4, micros: { ironMg: 2.3 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-humus", name: "Humus", servingGrams: 100, nutritionPer100g: { calories: 166, protein: 7.9, carbs: 14.3, fat: 9.6, fiber: 6, micros: { ironMg: 2.4, calciumMg: 38 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-haydari", name: "Haydari", servingGrams: 80, nutritionPer100g: { calories: 150, protein: 6, carbs: 4, fat: 12, fiber: 0.4, micros: { calciumMg: 140 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-piyaz", name: "Piyaz", servingGrams: 180, nutritionPer100g: { calories: 135, protein: 6, carbs: 16, fat: 5, fiber: 4.5, micros: { ironMg: 1.8 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-kisir", name: "Kısır", servingGrams: 150, nutritionPer100g: { calories: 185, protein: 4.5, carbs: 30, fat: 5.5, fiber: 4.2, micros: { ironMg: 1.6 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-mucver", name: "Mücver", servingGrams: 150, nutritionPer100g: { calories: 195, protein: 6, carbs: 14, fat: 12, fiber: 1.8, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-zeytin-siyah", name: "Siyah zeytin", servingGrams: 30, nutritionPer100g: { calories: 115, protein: 0.8, carbs: 6, fat: 11, fiber: 3.2, micros: { sodiumMg: 1550 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-zeytin-yesil", name: "Yeşil zeytin", servingGrams: 30, nutritionPer100g: { calories: 145, protein: 1, carbs: 3.8, fat: 15, fiber: 3.3, micros: { sodiumMg: 1560 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-tahin-pekmez", name: "Tahin pekmez", servingGrams: 40, nutritionPer100g: { calories: 470, protein: 11, carbs: 45, fat: 28, fiber: 3.5, micros: { ironMg: 4.5, calciumMg: 220 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-recel", name: "Çilek reçeli", servingGrams: 25, nutritionPer100g: { calories: 265, protein: 0.4, carbs: 65, fat: 0.1, fiber: 1, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-bal", name: "Bal", servingGrams: 20, nutritionPer100g: { calories: 304, protein: 0.3, carbs: 82, fat: 0, fiber: 0.2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-kaymak", name: "Kaymak", servingGrams: 30, nutritionPer100g: { calories: 395, protein: 3.5, carbs: 3, fat: 41, fiber: 0, micros: { calciumMg: 110 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-sucuk", name: "Sucuk", servingGrams: 50, nutritionPer100g: { calories: 415, protein: 22, carbs: 2, fat: 36, fiber: 0, micros: { sodiumMg: 1400, ironMg: 2.8 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-pastirma", name: "Pastırma", servingGrams: 40, nutritionPer100g: { calories: 240, protein: 35, carbs: 2, fat: 10, fiber: 0, micros: { sodiumMg: 1900, ironMg: 3.5 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-salam", name: "Salam", servingGrams: 40, nutritionPer100g: { calories: 310, protein: 15, carbs: 3, fat: 26, fiber: 0, micros: { sodiumMg: 1200 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-sosis", name: "Sosis", servingGrams: 50, nutritionPer100g: { calories: 300, protein: 12, carbs: 3, fat: 27, fiber: 0, micros: { sodiumMg: 1050 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-lor", name: "Lor peyniri", servingGrams: 60, nutritionPer100g: { calories: 98, protein: 11, carbs: 3, fat: 4, fiber: 0, micros: { calciumMg: 150 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-tulum", name: "Tulum peyniri", servingGrams: 30, nutritionPer100g: { calories: 375, protein: 24, carbs: 2, fat: 30, fiber: 0, micros: { sodiumMg: 1400, calciumMg: 600 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-ezine", name: "Ezine peyniri", servingGrams: 40, nutritionPer100g: { calories: 290, protein: 17, carbs: 2, fat: 24, fiber: 0, micros: { sodiumMg: 1100, calciumMg: 520 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-labne", name: "Labne", servingGrams: 30, nutritionPer100g: { calories: 235, protein: 6, carbs: 4, fat: 22, fiber: 0, micros: { calciumMg: 110 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-suzme-yogurt", name: "Süzme yoğurt", servingGrams: 150, nutritionPer100g: { calories: 96, protein: 9, carbs: 4, fat: 5, fiber: 0, micros: { calciumMg: 110 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-kefir", name: "Kefir", servingGrams: 200, nutritionPer100g: { calories: 55, protein: 3.3, carbs: 4.5, fat: 2.5, fiber: 0, micros: { calciumMg: 120 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-yayla", name: "Yayla çorbası", servingGrams: 250, nutritionPer100g: { calories: 62, protein: 2.8, carbs: 8, fat: 2.2, fiber: 0.6, micros: { calciumMg: 60 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-domates-corba", name: "Domates çorbası", servingGrams: 250, nutritionPer100g: { calories: 55, protein: 1.6, carbs: 8.5, fat: 1.8, fiber: 1, micros: { potassiumMg: 200 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-iskembe", name: "İşkembe çorbası", servingGrams: 250, nutritionPer100g: { calories: 85, protein: 7, carbs: 4, fat: 4.5, fiber: 0.2, micros: { sodiumMg: 520 } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-sehriye-corba", name: "Şehriyeli tavuk çorbası", servingGrams: 250, nutritionPer100g: { calories: 58, protein: 3.4, carbs: 8, fat: 1.4, fiber: 0.5, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "tr-brokoli-corba", name: "Brokoli çorbası", servingGrams: 250, nutritionPer100g: { calories: 60, protein: 2.5, carbs: 7, fat: 2.6, fiber: 1.8, micros: { vitaminCMg: 18 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-pizza-margherita", name: "Pizza Margherita", servingGrams: 300, nutritionPer100g: { calories: 266, protein: 11, carbs: 33, fat: 10, fiber: 2.3, micros: { calciumMg: 180, sodiumMg: 600 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-pizza-pepperoni", name: "Pepperoni pizza", servingGrams: 300, nutritionPer100g: { calories: 298, protein: 12.5, carbs: 30, fat: 14.5, fiber: 2.2, micros: { sodiumMg: 730 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-lasagna", name: "Lazanya", servingGrams: 300, nutritionPer100g: { calories: 155, protein: 9, carbs: 13, fat: 7.5, fiber: 1.2, micros: { calciumMg: 140 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-spaghetti-bolognese", name: "Spaghetti bolognese", servingGrams: 320, nutritionPer100g: { calories: 148, protein: 7.5, carbs: 18, fat: 5, fiber: 1.8, micros: { ironMg: 1.5 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-carbonara", name: "Spaghetti carbonara", servingGrams: 300, nutritionPer100g: { calories: 205, protein: 9, carbs: 22, fat: 9, fiber: 1.2, micros: { sodiumMg: 420 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-pesto-pasta", name: "Pesto soslu makarna", servingGrams: 300, nutritionPer100g: { calories: 215, protein: 7, carbs: 26, fat: 9.5, fiber: 2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-risotto", name: "Mantarlı risotto", servingGrams: 300, nutritionPer100g: { calories: 145, protein: 4, carbs: 22, fat: 4.5, fiber: 1, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-gnocchi", name: "Gnocchi", servingGrams: 250, nutritionPer100g: { calories: 155, protein: 4, carbs: 32, fat: 1.5, fiber: 2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-ratatouille", name: "Ratatouille", servingGrams: 250, nutritionPer100g: { calories: 72, protein: 1.6, carbs: 7, fat: 4.4, fiber: 2.6, micros: { potassiumMg: 290 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-paella", name: "Paella", servingGrams: 300, nutritionPer100g: { calories: 158, protein: 9, carbs: 20, fat: 4.5, fiber: 1.2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-tortilla-espanola", name: "İspanyol omleti", servingGrams: 180, nutritionPer100g: { calories: 180, protein: 7, carbs: 14, fat: 10.5, fiber: 1.4, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-schnitzel", name: "Wiener schnitzel", servingGrams: 180, nutritionPer100g: { calories: 285, protein: 20, carbs: 15, fat: 16, fiber: 0.8, micros: { sodiumMg: 420 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-goulash", name: "Gulaş", servingGrams: 300, nutritionPer100g: { calories: 125, protein: 11, carbs: 7, fat: 6, fiber: 1.2, micros: { ironMg: 1.9 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-moussaka-gr", name: "Yunan musakası", servingGrams: 300, nutritionPer100g: { calories: 150, protein: 7, carbs: 9, fat: 10, fiber: 2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-souvlaki", name: "Souvlaki", servingGrams: 180, nutritionPer100g: { calories: 190, protein: 24, carbs: 3, fat: 9, fiber: 0.4, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-tzatziki", name: "Tzatziki", servingGrams: 80, nutritionPer100g: { calories: 105, protein: 3, carbs: 4, fat: 8.5, fiber: 0.4, micros: { calciumMg: 100 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-croissant", name: "Kruvasan", servingGrams: 60, nutritionPer100g: { calories: 406, protein: 8.2, carbs: 45, fat: 21, fiber: 2.6, micros: { sodiumMg: 450 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-baguette", name: "Baget ekmek", servingGrams: 80, nutritionPer100g: { calories: 270, protein: 9, carbs: 55, fat: 1.5, fiber: 2.7, micros: { sodiumMg: 540 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-ciabatta", name: "Ciabatta", servingGrams: 80, nutritionPer100g: { calories: 271, protein: 9, carbs: 52, fat: 3, fiber: 2.5, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-rye-bread", name: "Çavdar ekmeği", servingGrams: 60, nutritionPer100g: { calories: 259, protein: 8.5, carbs: 48, fat: 3.3, fiber: 5.8, micros: { ironMg: 2.8 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-fish-chips", name: "Fish and chips", servingGrams: 300, nutritionPer100g: { calories: 245, protein: 12, carbs: 25, fat: 11, fiber: 2.2, micros: { sodiumMg: 420 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-shepherds-pie", name: "Shepherd's pie", servingGrams: 300, nutritionPer100g: { calories: 130, protein: 8, carbs: 12, fat: 5.5, fiber: 1.8, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-quiche", name: "Quiche Lorraine", servingGrams: 150, nutritionPer100g: { calories: 290, protein: 9, carbs: 20, fat: 19, fiber: 1, micros: { sodiumMg: 480 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-crepe", name: "Krep, sade", servingGrams: 100, nutritionPer100g: { calories: 215, protein: 6.5, carbs: 28, fat: 8.5, fiber: 1, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-waffle", name: "Waffle", servingGrams: 100, nutritionPer100g: { calories: 291, protein: 7.9, carbs: 33, fat: 14, fiber: 1.6, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-pancake", name: "Pancake", servingGrams: 100, nutritionPer100g: { calories: 227, protein: 6.4, carbs: 28, fat: 10, fiber: 1, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-caesar-salad", name: "Sezar salata", servingGrams: 220, nutritionPer100g: { calories: 190, protein: 9, carbs: 6, fat: 15, fiber: 1.6, micros: { sodiumMg: 430 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-greek-salad", name: "Yunan salatası", servingGrams: 220, nutritionPer100g: { calories: 110, protein: 4, carbs: 5, fat: 8.5, fiber: 1.8, micros: { sodiumMg: 420 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-coleslaw", name: "Coleslaw", servingGrams: 120, nutritionPer100g: { calories: 150, protein: 1.2, carbs: 12, fat: 11, fiber: 2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-mashed-potato-eu", name: "Tereyağlı patates püresi", servingGrams: 180, nutritionPer100g: { calories: 113, protein: 2, carbs: 15, fat: 5, fiber: 1.5, micros: { potassiumMg: 300 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-baked-beans", name: "Fırında fasulye", servingGrams: 200, nutritionPer100g: { calories: 94, protein: 4.8, carbs: 16, fat: 0.6, fiber: 4.7, micros: { ironMg: 1.4 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-hummus-eu", name: "Falafel", servingGrams: 120, nutritionPer100g: { calories: 333, protein: 13.3, carbs: 31.8, fat: 17.8, fiber: 4.9, micros: { ironMg: 3.4 } }, source: "FİT.AI temel besin listesi" },
  { id: "eu-sausage-roll", name: "Sosisli börek", servingGrams: 120, nutritionPer100g: { calories: 320, protein: 10, carbs: 26, fat: 20, fiber: 1.4, micros: { sodiumMg: 620 } }, source: "FİT.AI temel besin listesi" },
  { id: "ff-hamburger", name: "Hamburger", servingGrams: 220, nutritionPer100g: { calories: 254, protein: 13, carbs: 30, fat: 9.5, fiber: 1.6, micros: { sodiumMg: 490 } }, source: "FİT.AI temel besin listesi" },
  { id: "ff-cheeseburger", name: "Cheeseburger", servingGrams: 240, nutritionPer100g: { calories: 280, protein: 14.5, carbs: 28, fat: 12.5, fiber: 1.5, micros: { sodiumMg: 620 } }, source: "FİT.AI temel besin listesi" },
  { id: "ff-big-burger", name: "Büyük çift katlı burger", servingGrams: 280, nutritionPer100g: { calories: 295, protein: 16, carbs: 25, fat: 15, fiber: 1.6, micros: { sodiumMg: 700 } }, source: "FİT.AI temel besin listesi" },
  { id: "ff-chicken-burger", name: "Tavuk burger", servingGrams: 220, nutritionPer100g: { calories: 265, protein: 14, carbs: 29, fat: 11, fiber: 1.4, micros: { sodiumMg: 560 } }, source: "FİT.AI temel besin listesi" },
  { id: "ff-fries", name: "Patates kızartması", servingGrams: 150, nutritionPer100g: { calories: 312, protein: 3.4, carbs: 41, fat: 15, fiber: 3.8, micros: { sodiumMg: 260 } }, source: "FİT.AI temel besin listesi" },
  { id: "ff-onion-rings", name: "Soğan halkası", servingGrams: 100, nutritionPer100g: { calories: 411, protein: 5.5, carbs: 46, fat: 22, fiber: 2.8, micros: { sodiumMg: 480 } }, source: "FİT.AI temel besin listesi" },
  { id: "ff-nuggets", name: "Tavuk nugget", servingGrams: 120, nutritionPer100g: { calories: 296, protein: 15, carbs: 16, fat: 19, fiber: 1, micros: { sodiumMg: 540 } }, source: "FİT.AI temel besin listesi" },
  { id: "ff-hot-dog", name: "Sosisli sandviç", servingGrams: 150, nutritionPer100g: { calories: 290, protein: 11, carbs: 24, fat: 17, fiber: 1.2, micros: { sodiumMg: 800 } }, source: "FİT.AI temel besin listesi" },
  { id: "ff-wrap", name: "Tavuklu wrap", servingGrams: 250, nutritionPer100g: { calories: 215, protein: 13, carbs: 22, fat: 8.5, fiber: 1.8, micros: { sodiumMg: 480 } }, source: "FİT.AI temel besin listesi" },
  { id: "ff-club-sandwich", name: "Kulüp sandviç", servingGrams: 250, nutritionPer100g: { calories: 240, protein: 13, carbs: 22, fat: 11, fiber: 1.5, micros: { sodiumMg: 560 } }, source: "FİT.AI temel besin listesi" },
  { id: "ff-tost", name: "Karışık tost", servingGrams: 180, nutritionPer100g: { calories: 285, protein: 13, carbs: 28, fat: 13, fiber: 1.6, micros: { calciumMg: 210, sodiumMg: 700 } }, source: "FİT.AI temel besin listesi" },
  { id: "ff-sushi", name: "Sushi (karışık)", servingGrams: 200, nutritionPer100g: { calories: 145, protein: 6, carbs: 28, fat: 1.5, fiber: 0.8, micros: { sodiumMg: 320 } }, source: "FİT.AI temel besin listesi" },
  { id: "ff-noodle", name: "Hazır erişte", servingGrams: 80, nutritionPer100g: { calories: 440, protein: 10, carbs: 60, fat: 17, fiber: 2.5, micros: { sodiumMg: 1700 } }, source: "FİT.AI temel besin listesi" },
  { id: "ff-taco", name: "Taco", servingGrams: 150, nutritionPer100g: { calories: 215, protein: 10, carbs: 20, fat: 10.5, fiber: 2.5, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "ff-burrito", name: "Burrito", servingGrams: 300, nutritionPer100g: { calories: 205, protein: 9, carbs: 26, fat: 7, fiber: 2.8, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-magnum", name: "Magnum bademli", brand: "Algida", servingGrams: 100, nutritionPer100g: { calories: 285, protein: 4, carbs: 30, fat: 16, fiber: 1, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-cornetto", name: "Cornetto külah dondurma", brand: "Algida", servingGrams: 100, nutritionPer100g: { calories: 255, protein: 3.5, carbs: 32, fat: 12.5, fiber: 0.8, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-milka", name: "Milka sütlü çikolata", brand: "Milka", servingGrams: 25, nutritionPer100g: { calories: 534, protein: 6.3, carbs: 58, fat: 29.5, fiber: 1.5, micros: { calciumMg: 200 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-nutella", name: "Nutella", brand: "Ferrero", servingGrams: 20, nutritionPer100g: { calories: 539, protein: 6.3, carbs: 57.5, fat: 30.9, fiber: 3.4, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-toblerone", name: "Toblerone", brand: "Toblerone", servingGrams: 25, nutritionPer100g: { calories: 525, protein: 5.5, carbs: 60, fat: 29, fiber: 1.8, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-bounty", name: "Bounty", brand: "Mars", servingGrams: 28, nutritionPer100g: { calories: 473, protein: 3.6, carbs: 58, fat: 25, fiber: 3, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-ferrero", name: "Ferrero Rocher", brand: "Ferrero", servingGrams: 25, nutritionPer100g: { calories: 580, protein: 8.5, carbs: 44, fat: 42, fiber: 4, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-ulker-cikolatali-bisküvi", name: "Ülker Çikolatalı Bisküvi", brand: "Ülker", servingGrams: 40, nutritionPer100g: { calories: 490, protein: 6, carbs: 63, fat: 23, fiber: 2.2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-halley", name: "Halley", brand: "Ülker", servingGrams: 30, nutritionPer100g: { calories: 420, protein: 4.5, carbs: 66, fat: 15, fiber: 1.5, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-eti-cin", name: "Eti Cin", brand: "Eti", servingGrams: 30, nutritionPer100g: { calories: 455, protein: 5, carbs: 64, fat: 20, fiber: 1.8, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-eti-canga", name: "Eti Cini/Çanga", brand: "Eti", servingGrams: 35, nutritionPer100g: { calories: 505, protein: 7, carbs: 52, fat: 29, fiber: 2.5, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-albeni", name: "Albeni", brand: "Ülker", servingGrams: 40, nutritionPer100g: { calories: 455, protein: 4.5, carbs: 63, fat: 20, fiber: 1.4, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-metro", name: "Metro bar", brand: "Ülker", servingGrams: 36, nutritionPer100g: { calories: 470, protein: 5, carbs: 62, fat: 22, fiber: 1.6, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-cokokrem", name: "Çokokrem", brand: "Ülker", servingGrams: 20, nutritionPer100g: { calories: 530, protein: 6, carbs: 58, fat: 30, fiber: 2.5, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-ruffles", name: "Ruffles patates cipsi", brand: "Ruffles", servingGrams: 30, nutritionPer100g: { calories: 540, protein: 6, carbs: 52, fat: 33, fiber: 4, micros: { sodiumMg: 600 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-pringles", name: "Pringles orijinal", brand: "Pringles", servingGrams: 30, nutritionPer100g: { calories: 536, protein: 4, carbs: 51, fat: 34, fiber: 3, micros: { sodiumMg: 650 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-patos", name: "Patos", brand: "Patos", servingGrams: 35, nutritionPer100g: { calories: 520, protein: 6, carbs: 55, fat: 30, fiber: 2.5, micros: { sodiumMg: 720 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-cheese-cracker", name: "Peynirli kraker", servingGrams: 30, nutritionPer100g: { calories: 480, protein: 9, carbs: 60, fat: 22, fiber: 2.5, micros: { sodiumMg: 800 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-tuc", name: "Tuzlu kraker", servingGrams: 25, nutritionPer100g: { calories: 480, protein: 9, carbs: 63, fat: 21, fiber: 2.5, micros: { sodiumMg: 1100 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-popcorn", name: "Patlamış mısır, tuzlu", servingGrams: 30, nutritionPer100g: { calories: 387, protein: 12, carbs: 78, fat: 4.5, fiber: 15, micros: { sodiumMg: 600 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-pretzel", name: "Tuzlu çubuk kraker", servingGrams: 30, nutritionPer100g: { calories: 380, protein: 10, carbs: 79, fat: 3, fiber: 3, micros: { sodiumMg: 1300 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-leblebi", name: "Leblebi", servingGrams: 40, nutritionPer100g: { calories: 370, protein: 20, carbs: 55, fat: 6, fiber: 10, micros: { ironMg: 4.5 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-ay-cekirdegi", name: "Ay çekirdeği", servingGrams: 30, nutritionPer100g: { calories: 584, protein: 21, carbs: 20, fat: 51, fiber: 8.6, micros: { ironMg: 5.2 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-findik", name: "Fındık", servingGrams: 30, nutritionPer100g: { calories: 628, protein: 15, carbs: 17, fat: 61, fiber: 9.7, micros: { calciumMg: 114 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-antep-fistigi", name: "Antep fıstığı", servingGrams: 30, nutritionPer100g: { calories: 562, protein: 20, carbs: 28, fat: 45, fiber: 10.3, micros: { potassiumMg: 1025 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-kaju", name: "Kaju", servingGrams: 30, nutritionPer100g: { calories: 553, protein: 18, carbs: 30, fat: 44, fiber: 3.3, micros: { ironMg: 6.7 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-yer-fistigi", name: "Yer fıstığı", servingGrams: 30, nutritionPer100g: { calories: 567, protein: 26, carbs: 16, fat: 49, fiber: 8.5, micros: { ironMg: 4.6 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-kuru-uzum", name: "Kuru üzüm", servingGrams: 40, nutritionPer100g: { calories: 299, protein: 3.1, carbs: 79, fat: 0.5, fiber: 3.7, micros: { potassiumMg: 749 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-kuru-kayisi", name: "Kuru kayısı", servingGrams: 40, nutritionPer100g: { calories: 241, protein: 3.4, carbs: 63, fat: 0.5, fiber: 7.3, micros: { potassiumMg: 1162 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-hurma", name: "Hurma", servingGrams: 40, nutritionPer100g: { calories: 277, protein: 1.8, carbs: 75, fat: 0.2, fiber: 6.7, micros: { potassiumMg: 696 } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-granola-bar", name: "Granola bar", servingGrams: 40, nutritionPer100g: { calories: 420, protein: 7, carbs: 65, fat: 14, fiber: 5, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "snack-rice-cake", name: "Pirinç patlağı", servingGrams: 20, nutritionPer100g: { calories: 387, protein: 8, carbs: 81, fat: 3, fiber: 4, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-cola", name: "Kola", servingGrams: 330, nutritionPer100g: { calories: 42, protein: 0, carbs: 10.6, fat: 0, fiber: 0, micros: { sodiumMg: 10 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-cola-zero", name: "Kola, şekersiz", servingGrams: 330, nutritionPer100g: { calories: 0.3, protein: 0, carbs: 0, fat: 0, fiber: 0, micros: { sodiumMg: 10 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-fanta", name: "Portakallı gazoz", servingGrams: 330, nutritionPer100g: { calories: 45, protein: 0, carbs: 11.2, fat: 0, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-sprite", name: "Limonlu gazoz", servingGrams: 330, nutritionPer100g: { calories: 37, protein: 0, carbs: 9.3, fat: 0, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-soda", name: "Maden suyu", servingGrams: 250, nutritionPer100g: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, micros: { sodiumMg: 20, calciumMg: 30 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-portakal-suyu", name: "Portakal suyu", servingGrams: 250, nutritionPer100g: { calories: 45, protein: 0.7, carbs: 10.4, fat: 0.2, fiber: 0.2, micros: { vitaminCMg: 50 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-elma-suyu", name: "Elma suyu", servingGrams: 250, nutritionPer100g: { calories: 46, protein: 0.1, carbs: 11.3, fat: 0.1, fiber: 0.2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-visne-suyu", name: "Vişne suyu", servingGrams: 250, nutritionPer100g: { calories: 50, protein: 0.4, carbs: 12, fat: 0.1, fiber: 0.2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-seftali-suyu", name: "Şeftali nektarı", servingGrams: 250, nutritionPer100g: { calories: 54, protein: 0.3, carbs: 13, fat: 0.1, fiber: 0.3, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-limonata", name: "Limonata", servingGrams: 250, nutritionPer100g: { calories: 42, protein: 0.1, carbs: 10.5, fat: 0, fiber: 0.1, micros: { vitaminCMg: 12 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-ice-tea", name: "Soğuk çay, şeftalili", servingGrams: 330, nutritionPer100g: { calories: 30, protein: 0, carbs: 7.5, fat: 0, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-cay", name: "Çay, şekersiz", servingGrams: 200, nutritionPer100g: { calories: 1, protein: 0, carbs: 0.2, fat: 0, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-cay-sekerli", name: "Çay, 2 şekerli", servingGrams: 200, nutritionPer100g: { calories: 17, protein: 0, carbs: 4.3, fat: 0, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-turk-kahvesi", name: "Türk kahvesi, sade", servingGrams: 70, nutritionPer100g: { calories: 2, protein: 0.2, carbs: 0.3, fat: 0, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-filtre-kahve", name: "Filtre kahve, sade", servingGrams: 240, nutritionPer100g: { calories: 2, protein: 0.3, carbs: 0, fat: 0, fiber: 0, micros: { potassiumMg: 49 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-latte", name: "Caffè latte", servingGrams: 330, nutritionPer100g: { calories: 55, protein: 3.1, carbs: 5.3, fat: 2, fiber: 0, micros: { calciumMg: 110 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-cappuccino", name: "Cappuccino", servingGrams: 200, nutritionPer100g: { calories: 42, protein: 2.4, carbs: 4, fat: 1.6, fiber: 0, micros: { calciumMg: 90 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-americano", name: "Americano", servingGrams: 240, nutritionPer100g: { calories: 3, protein: 0.3, carbs: 0.5, fat: 0, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-mocha", name: "Mocha", servingGrams: 330, nutritionPer100g: { calories: 95, protein: 3.4, carbs: 13, fat: 3.2, fiber: 0.8, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-sicak-cikolata", name: "Sıcak çikolata", servingGrams: 250, nutritionPer100g: { calories: 90, protein: 3.2, carbs: 13, fat: 2.8, fiber: 1, micros: { calciumMg: 100 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-salep", name: "Salep", servingGrams: 250, nutritionPer100g: { calories: 105, protein: 3.5, carbs: 17, fat: 2.6, fiber: 0.4, micros: { calciumMg: 110 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-boza", name: "Boza", servingGrams: 250, nutritionPer100g: { calories: 88, protein: 1.2, carbs: 20, fat: 0.1, fiber: 0.8, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-sahlep-hazir", name: "Limonlu buzlu çay, şekersiz", servingGrams: 330, nutritionPer100g: { calories: 1, protein: 0, carbs: 0.2, fat: 0, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-enerji", name: "Enerji içeceği", servingGrams: 250, nutritionPer100g: { calories: 45, protein: 0, carbs: 11, fat: 0, fiber: 0, micros: { sodiumMg: 100 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-enerji-zero", name: "Enerji içeceği, şekersiz", servingGrams: 250, nutritionPer100g: { calories: 3, protein: 0, carbs: 0.6, fat: 0, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-sporcu", name: "Sporcu içeceği", servingGrams: 500, nutritionPer100g: { calories: 24, protein: 0, carbs: 6, fat: 0, fiber: 0, micros: { sodiumMg: 45, potassiumMg: 12 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-protein-shake", name: "Protein shake, sütlü", servingGrams: 300, nutritionPer100g: { calories: 72, protein: 9, carbs: 5, fat: 2, fiber: 0.4, micros: { calciumMg: 120 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-smoothie", name: "Meyveli smoothie", servingGrams: 300, nutritionPer100g: { calories: 62, protein: 1, carbs: 14, fat: 0.4, fiber: 1.6, micros: { vitaminCMg: 22 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-milkshake", name: "Milkshake, çikolatalı", servingGrams: 300, nutritionPer100g: { calories: 120, protein: 3.5, carbs: 19, fat: 3.6, fiber: 0.6, micros: { calciumMg: 110 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-badem-sutu", name: "Badem sütü, şekersiz", servingGrams: 250, nutritionPer100g: { calories: 15, protein: 0.6, carbs: 0.6, fat: 1.2, fiber: 0.3, micros: { calciumMg: 120 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-yulaf-sutu", name: "Yulaf sütü", servingGrams: 250, nutritionPer100g: { calories: 47, protein: 1, carbs: 7.5, fat: 1.5, fiber: 0.8, micros: { calciumMg: 120 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-tam-yagli-sut", name: "Süt, tam yağlı", servingGrams: 250, nutritionPer100g: { calories: 64, protein: 3.2, carbs: 4.8, fat: 3.6, fiber: 0, micros: { calciumMg: 120 } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-bira", name: "Bira", servingGrams: 330, nutritionPer100g: { calories: 43, protein: 0.5, carbs: 3.6, fat: 0, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-sarap-kirmizi", name: "Kırmızı şarap", servingGrams: 150, nutritionPer100g: { calories: 85, protein: 0.1, carbs: 2.6, fat: 0, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-sarap-beyaz", name: "Beyaz şarap", servingGrams: 150, nutritionPer100g: { calories: 82, protein: 0.1, carbs: 2.6, fat: 0, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-raki", name: "Rakı", servingGrams: 50, nutritionPer100g: { calories: 240, protein: 0, carbs: 0, fat: 0, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-votka", name: "Votka", servingGrams: 50, nutritionPer100g: { calories: 231, protein: 0, carbs: 0, fat: 0, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "drink-viski", name: "Viski", servingGrams: 50, nutritionPer100g: { calories: 250, protein: 0, carbs: 0.1, fat: 0, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-baklava", name: "Baklava", servingGrams: 100, nutritionPer100g: { calories: 430, protein: 6, carbs: 50, fat: 23, fiber: 1.8, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-kunefe", name: "Künefe", servingGrams: 150, nutritionPer100g: { calories: 380, protein: 9, carbs: 42, fat: 19, fiber: 1, micros: { calciumMg: 180 } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-sutlac", name: "Sütlaç", servingGrams: 150, nutritionPer100g: { calories: 135, protein: 3.5, carbs: 23, fat: 3, fiber: 0.3, micros: { calciumMg: 110 } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-kazandibi", name: "Kazandibi", servingGrams: 120, nutritionPer100g: { calories: 155, protein: 4, carbs: 26, fat: 3.6, fiber: 0.2, micros: { calciumMg: 115 } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-tavuk-gogsu", name: "Tavuk göğsü tatlısı", servingGrams: 120, nutritionPer100g: { calories: 150, protein: 4.5, carbs: 25, fat: 3.4, fiber: 0.2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-revani", name: "Revani", servingGrams: 100, nutritionPer100g: { calories: 330, protein: 4.5, carbs: 55, fat: 10, fiber: 0.8, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-sekerpare", name: "Şekerpare", servingGrams: 80, nutritionPer100g: { calories: 360, protein: 4, carbs: 58, fat: 13, fiber: 0.9, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-tulumba", name: "Tulumba tatlısı", servingGrams: 90, nutritionPer100g: { calories: 395, protein: 3.5, carbs: 58, fat: 17, fiber: 0.6, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-lokma", name: "Lokma", servingGrams: 90, nutritionPer100g: { calories: 370, protein: 4, carbs: 55, fat: 15, fiber: 1, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-kadayif", name: "Tel kadayıf", servingGrams: 120, nutritionPer100g: { calories: 395, protein: 6, carbs: 52, fat: 19, fiber: 1.4, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-irmik-helvasi", name: "İrmik helvası", servingGrams: 100, nutritionPer100g: { calories: 410, protein: 5, carbs: 55, fat: 19, fiber: 1.2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-un-helvasi", name: "Un helvası", servingGrams: 80, nutritionPer100g: { calories: 450, protein: 4, carbs: 55, fat: 24, fiber: 1, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-asure", name: "Aşure", servingGrams: 180, nutritionPer100g: { calories: 145, protein: 3, carbs: 30, fat: 1.8, fiber: 2.4, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-kabak-tatlisi", name: "Kabak tatlısı", servingGrams: 150, nutritionPer100g: { calories: 180, protein: 1.2, carbs: 42, fat: 0.5, fiber: 1.8, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-ayva-tatlisi", name: "Ayva tatlısı", servingGrams: 150, nutritionPer100g: { calories: 155, protein: 0.5, carbs: 38, fat: 0.3, fiber: 3.2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-lokum", name: "Lokum", servingGrams: 30, nutritionPer100g: { calories: 340, protein: 0.2, carbs: 84, fat: 0.2, fiber: 0.5, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-pismaniye", name: "Pişmaniye", servingGrams: 30, nutritionPer100g: { calories: 470, protein: 6, carbs: 60, fat: 22, fiber: 1.2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-magnolia", name: "Magnolia", servingGrams: 150, nutritionPer100g: { calories: 215, protein: 3.5, carbs: 28, fat: 10, fiber: 0.6, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-cheesecake", name: "Cheesecake", servingGrams: 120, nutritionPer100g: { calories: 321, protein: 5.5, carbs: 26, fat: 22, fiber: 0.6, micros: { calciumMg: 80 } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-tiramisu", name: "Tiramisu", servingGrams: 120, nutritionPer100g: { calories: 283, protein: 5, carbs: 28, fat: 17, fiber: 0.5, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-brownie", name: "Brownie", servingGrams: 80, nutritionPer100g: { calories: 466, protein: 6, carbs: 50, fat: 27, fiber: 2.5, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-profiterol", name: "Profiterol", servingGrams: 120, nutritionPer100g: { calories: 290, protein: 5, carbs: 32, fat: 16, fiber: 1, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-muffin", name: "Çikolatalı muffin", servingGrams: 90, nutritionPer100g: { calories: 380, protein: 5.5, carbs: 50, fat: 18, fiber: 2, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-donut", name: "Donut", servingGrams: 70, nutritionPer100g: { calories: 420, protein: 5, carbs: 50, fat: 22, fiber: 1.5, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-pasta-dilimi", name: "Yaş pasta dilimi", servingGrams: 120, nutritionPer100g: { calories: 350, protein: 4, carbs: 45, fat: 17, fiber: 0.8, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-kurabiye", name: "Tereyağlı kurabiye", servingGrams: 40, nutritionPer100g: { calories: 480, protein: 6, carbs: 58, fat: 25, fiber: 1.5, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-dondurma-vanilya", name: "Vanilyalı dondurma", servingGrams: 100, nutritionPer100g: { calories: 207, protein: 3.5, carbs: 24, fat: 11, fiber: 0.7, micros: { calciumMg: 128 } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-dondurma-cikolata", name: "Çikolatalı dondurma", servingGrams: 100, nutritionPer100g: { calories: 216, protein: 3.8, carbs: 28, fat: 11, fiber: 1.2, micros: { calciumMg: 110 } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-mousse", name: "Çikolatalı mousse", servingGrams: 100, nutritionPer100g: { calories: 225, protein: 4, carbs: 25, fat: 12, fiber: 1.4, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-pudding", name: "Puding, çikolatalı", servingGrams: 120, nutritionPer100g: { calories: 120, protein: 3, carbs: 20, fat: 3, fiber: 0.6, micros: { calciumMg: 100 } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-apple-pie", name: "Elmalı turta", servingGrams: 120, nutritionPer100g: { calories: 265, protein: 2.4, carbs: 38, fat: 11.5, fiber: 1.6, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "dessert-macaron", name: "Makaron", servingGrams: 20, nutritionPer100g: { calories: 404, protein: 7, carbs: 60, fat: 15, fiber: 2.5, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "base-brown-rice", name: "Esmer pirinç, pişmiş", servingGrams: 180, nutritionPer100g: { calories: 123, protein: 2.7, carbs: 26, fat: 1, fiber: 1.6, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "base-quinoa", name: "Kinoa, pişmiş", servingGrams: 180, nutritionPer100g: { calories: 120, protein: 4.4, carbs: 21, fat: 1.9, fiber: 2.8, micros: { ironMg: 1.5 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-couscous", name: "Kuskus, pişmiş", servingGrams: 180, nutritionPer100g: { calories: 112, protein: 3.8, carbs: 23, fat: 0.2, fiber: 1.4, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "base-kirmizi-mercimek", name: "Kırmızı mercimek, pişmiş", servingGrams: 150, nutritionPer100g: { calories: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9, micros: { ironMg: 3.3 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-barbunya", name: "Barbunya, pişmiş", servingGrams: 150, nutritionPer100g: { calories: 127, protein: 9, carbs: 23, fat: 0.5, fiber: 9, micros: { ironMg: 2.9 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-tofu", name: "Tofu", servingGrams: 100, nutritionPer100g: { calories: 76, protein: 8, carbs: 1.9, fat: 4.8, fiber: 0.3, micros: { calciumMg: 350 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-hindi", name: "Hindi göğsü, pişmiş", servingGrams: 150, nutritionPer100g: { calories: 135, protein: 30, carbs: 0, fat: 1.7, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "base-dana-kiyma", name: "Dana kıyma, pişmiş", servingGrams: 150, nutritionPer100g: { calories: 250, protein: 26, carbs: 0, fat: 16, fiber: 0, micros: { ironMg: 2.6 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-kuzu", name: "Kuzu eti, pişmiş", servingGrams: 150, nutritionPer100g: { calories: 294, protein: 25, carbs: 0, fat: 21, fiber: 0, micros: { ironMg: 1.9 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-yumurta-beyazi", name: "Yumurta beyazı", servingGrams: 100, nutritionPer100g: { calories: 52, protein: 10.9, carbs: 0.7, fat: 0.2, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "base-uskumru", name: "Uskumru, pişmiş", servingGrams: 150, nutritionPer100g: { calories: 262, protein: 24, carbs: 0, fat: 18, fiber: 0, micros: { potassiumMg: 314 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-karides", name: "Karides, pişmiş", servingGrams: 120, nutritionPer100g: { calories: 99, protein: 24, carbs: 0.2, fat: 0.3, fiber: 0, micros: { sodiumMg: 111 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-brokoli", name: "Brokoli, haşlanmış", servingGrams: 150, nutritionPer100g: { calories: 35, protein: 2.4, carbs: 7, fat: 0.4, fiber: 3.3, micros: { vitaminCMg: 65 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-karnabahar", name: "Karnabahar, haşlanmış", servingGrams: 150, nutritionPer100g: { calories: 23, protein: 1.8, carbs: 4.1, fat: 0.5, fiber: 2.3, micros: { vitaminCMg: 44 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-havuc", name: "Havuç", servingGrams: 100, nutritionPer100g: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiber: 2.8, micros: { potassiumMg: 320 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-domates", name: "Domates", servingGrams: 150, nutritionPer100g: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, micros: { vitaminCMg: 14 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-salatalik", name: "Salatalık", servingGrams: 150, nutritionPer100g: { calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "base-marul", name: "Marul", servingGrams: 100, nutritionPer100g: { calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, fiber: 1.3, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "base-avokado", name: "Avokado", servingGrams: 100, nutritionPer100g: { calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, micros: { potassiumMg: 485 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-tatli-patates", name: "Tatlı patates, fırında", servingGrams: 150, nutritionPer100g: { calories: 90, protein: 2, carbs: 20.7, fat: 0.2, fiber: 3.3, micros: { potassiumMg: 475 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-misir", name: "Mısır, haşlanmış", servingGrams: 150, nutritionPer100g: { calories: 96, protein: 3.4, carbs: 21, fat: 1.5, fiber: 2.4, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "base-bezelye", name: "Bezelye, haşlanmış", servingGrams: 150, nutritionPer100g: { calories: 84, protein: 5.4, carbs: 15, fat: 0.2, fiber: 5.5, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "base-cilek", name: "Çilek", servingGrams: 150, nutritionPer100g: { calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2, micros: { vitaminCMg: 59 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-uzum", name: "Üzüm", servingGrams: 150, nutritionPer100g: { calories: 69, protein: 0.7, carbs: 18, fat: 0.2, fiber: 0.9, micros: { potassiumMg: 191 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-karpuz", name: "Karpuz", servingGrams: 250, nutritionPer100g: { calories: 30, protein: 0.6, carbs: 7.6, fat: 0.2, fiber: 0.4, micros: { vitaminCMg: 8 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-kavun", name: "Kavun", servingGrams: 200, nutritionPer100g: { calories: 34, protein: 0.8, carbs: 8.2, fat: 0.2, fiber: 0.9, micros: { vitaminCMg: 37 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-armut", name: "Armut", servingGrams: 180, nutritionPer100g: { calories: 57, protein: 0.4, carbs: 15, fat: 0.1, fiber: 3.1, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "base-seftali", name: "Şeftali", servingGrams: 150, nutritionPer100g: { calories: 39, protein: 0.9, carbs: 9.5, fat: 0.3, fiber: 1.5, micros: { vitaminCMg: 7 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-kivi", name: "Kivi", servingGrams: 100, nutritionPer100g: { calories: 61, protein: 1.1, carbs: 15, fat: 0.5, fiber: 3, micros: { vitaminCMg: 93 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-ananas", name: "Ananas", servingGrams: 150, nutritionPer100g: { calories: 50, protein: 0.5, carbs: 13, fat: 0.1, fiber: 1.4, micros: { vitaminCMg: 48 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-nar", name: "Nar", servingGrams: 150, nutritionPer100g: { calories: 83, protein: 1.7, carbs: 19, fat: 1.2, fiber: 4, micros: { vitaminCMg: 10 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-incir", name: "İncir", servingGrams: 100, nutritionPer100g: { calories: 74, protein: 0.8, carbs: 19, fat: 0.3, fiber: 2.9, micros: { potassiumMg: 232 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-zeytinyagi", name: "Zeytinyağı", servingGrams: 10, nutritionPer100g: { calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, micros: {  } }, source: "FİT.AI temel besin listesi" },
  { id: "base-tereyagi", name: "Tereyağı", servingGrams: 10, nutritionPer100g: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81, fiber: 0, micros: { sodiumMg: 11 } }, source: "FİT.AI temel besin listesi" },
  { id: "base-findik-ezmesi", name: "Fıstık ezmesi", servingGrams: 20, nutritionPer100g: { calories: 588, protein: 25, carbs: 20, fat: 50, fiber: 6, micros: {  } }, source: "FİT.AI temel besin listesi" },
];

// Eşleşme kalitesine göre puan. Düz "içeriyor mu" kontrolü, "kola" aramasında
// "çikolata" gibi alakasız sonuçları öne çıkarıyordu; tam ad ve kelime başı
// eşleşmeleri artık her zaman kelime içi eşleşmelerin önünde geliyor.
function localFoodScore(query: string, searchable: string, terms: string[]) {
  if (searchable === query) return 0;
  if (searchable.startsWith(`${query} `) || searchable.startsWith(`${query},`)) return 1;
  const words = searchable.split(/[\s,]+/);
  if (words.includes(query)) return 2;
  if (terms.every((term) => words.some((word) => word.startsWith(term)))) return 3;
  return 4;
}

export function searchLocalFoods(query: string, limit = 6) {
  const normalizedQuery = normalizeFoodSearchText(query);
  if (normalizedQuery.length < 2) return [];
  const terms = normalizedQuery.split(" ");
  return staples
    .flatMap((food) => {
      const searchable = normalizeFoodSearchText(`${food.name} ${food.brand || ""}`);
      const matches = terms.every((term) => {
        const alternatives = term.endsWith("k") ? [term, `${term.slice(0, -1)}g`] : [term];
        return alternatives.some((candidate) => searchable.includes(candidate));
      });
      return matches ? [{ food, score: localFoodScore(normalizedQuery, searchable, terms) }] : [];
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((item) => item.food);
}

export function mergeFoodResults(local: FoodSearchResult[], remote: FoodSearchResult[], limit = 8) {
  const unique = new Map<string, FoodSearchResult>();
  [...local, ...remote].forEach((food) => {
    const key = `${normalizeFoodSearchText(food.name)}-${food.barcode || ""}`;
    if (!unique.has(key)) unique.set(key, food);
  });
  return [...unique.values()].slice(0, limit);
}
