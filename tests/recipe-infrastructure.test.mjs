import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateRecipeNutrition, nutritionForRecipeAmount } from "../lib/recipe-nutrition.ts";
import { recipeRowToSearchResult } from "../lib/recipe-data.ts";
import { usdaFoodToIngredientBasis } from "../lib/providers/usda-food-data.ts";

const rice = {
  key: "pirinc",
  name: "Pirinç",
  rawWeightGrams: 200,
  nutrition: {
    caloriesPer100g: 360,
    proteinPer100g: 7,
    carbohydratesPer100g: 79,
    fatPer100g: 0.7,
    fiberPer100g: 1.3,
    source: "usda_fdc",
    sourceId: "test-rice",
    confidence: "high",
  },
};

test("tarif hesabı toplamı, pişmiş ağırlığa göre 100 gramı ve porsiyonu ayrı hesaplar", () => {
  const result = calculateRecipeNutrition({
    recipeSlug: "pirinc-pilavi",
    recipeVersion: "1.0.0",
    cookedWeightGrams: 600,
    defaultPortionGrams: 180,
    ingredients: [rice],
  });
  assert.equal(result.total.calories, 720);
  assert.equal(result.per100g.calories, 120);
  assert.equal(result.perPortion.calories, 216);
  assert.equal(result.calculationMethod, "provider_energy");
  assert.equal(result.status, "published");
});

test("aynı malzeme daha düşük pişmiş ağırlıkta daha yoğun 100 gram değeri üretir", () => {
  const base = { recipeSlug: "pilav", recipeVersion: "1", defaultPortionGrams: 150, ingredients: [rice] };
  const hydrated = calculateRecipeNutrition({ ...base, cookedWeightGrams: 600 });
  const reduced = calculateRecipeNutrition({ ...base, cookedWeightGrams: 400 });
  assert.equal(reduced.total.calories, hydrated.total.calories);
  assert.ok(reduced.per100g.calories > hydrated.per100g.calories);
});

test("kaynak enerji yoksa 4/4/9 yalnız tahmin olarak kullanılır ve inceleme gerekir", () => {
  const result = calculateRecipeNutrition({
    recipeSlug: "ornek",
    recipeVersion: "1",
    cookedWeightGrams: 100,
    defaultPortionGrams: 100,
    ingredients: [{
      key: "malzeme",
      name: "Malzeme",
      rawWeightGrams: 100,
      nutrition: {
        caloriesPer100g: null,
        proteinPer100g: 10,
        carbohydratesPer100g: 20,
        fatPer100g: 5,
        fiberPer100g: 2,
        source: "manual_reference",
        confidence: "medium",
      },
    }],
  });
  assert.equal(result.total.calories, 165);
  assert.equal(result.calculationMethod, "atwater_estimate");
  assert.equal(result.needsReview, true);
  assert.match(result.warnings.join(" "), /Atwater 4\/4\/9/);
});

test("gram ve porsiyon sorguları aynı 100 gram tabanından ölçeklenir", () => {
  const per100g = { calories: 200, protein: 10, carbohydrates: 20, fat: 8, fiber: 3 };
  assert.deepEqual(nutritionForRecipeAmount(per100g, { grams: 250, defaultPortionGrams: 150 }), {
    grams: 250,
    nutrition: { calories: 500, protein: 25, carbohydrates: 50, fat: 20, fiber: 7.5 },
  });
  assert.equal(nutritionForRecipeAmount(per100g, { portions: 2, defaultPortionGrams: 150 }).grams, 300);
});

test("USDA sağlayıcısı enerji ve makroları kaynak kimliğiyle malzeme tabanına çevirir", () => {
  const basis = usdaFoodToIngredientBasis({
    fdcId: 123,
    description: "Test ingredient",
    foodNutrients: [
      { nutrientId: 1008, value: 100 },
      { nutrientId: 1003, value: 5 },
      { nutrientId: 1005, value: 10 },
      { nutrientId: 1004, value: 4 },
      { nutrientId: 1079, value: 2 },
    ],
  });
  assert.equal(basis?.source, "usda_fdc");
  assert.equal(basis?.sourceId, "123");
  assert.equal(basis?.caloriesPer100g, 100);
});

test("yayınlanmış tarif satırı mevcut yemek arama modeline porsiyon bilgisiyle bağlanır", () => {
  const result = recipeRowToSearchResult({
    recipe_version_id: "00000000-0000-4000-8000-000000000001",
    slug: "sucuklu-yumurta",
    name: "Sucuklu yumurta",
    alternative_names: ["sucuk yumurta"],
    category: "Kahvaltı",
    region: "Türkiye",
    version: "1.0.0",
    default_portion_grams: 170,
    cooked_weight_grams: 340,
    calories_per_100g: 250,
    protein_per_100g: 16,
    carbs_per_100g: 2,
    fat_per_100g: 20,
    fiber_per_100g: 0,
    confidence_level: "high",
    calculation_method: "provider_energy",
  });
  assert.equal(result?.kind, "recipe");
  assert.equal(result?.servingGrams, 170);
  assert.equal(result?.recipeVersion, "1.0.0");
});

test("200 yemeklik seed tekrarsızdır ve kaynaksız kayıtları yayımlamaz", async () => {
  const seed = JSON.parse(await readFile(new URL("../data/turkish-recipes.seed.json", import.meta.url), "utf8"));
  assert.equal(seed.dishes.length, 200);
  assert.equal(new Set(seed.dishes.map((dish) => dish.slug)).size, 200);
  for (const dish of seed.dishes) {
    assert.ok(Array.isArray(dish.ingredients));
    if (!dish.ingredients.length) {
      assert.equal(dish.reviewStatus, "needs_review");
      assert.equal(dish.confidenceLevel, "low");
      assert.equal(dish.nutritionPer100g, null);
    }
  }
});

test("migration sürüm, kaynak, malzeme ve hesaplama geçmişini; import idempotency'yi içerir", async () => {
  const [migration, importer, searchRoute, barcodeRoute, detailRoute] = await Promise.all([
    readFile(new URL("../db/migrations/20260730_turkish_recipe_infrastructure.sql", import.meta.url), "utf8"),
    readFile(new URL("../scripts/import-turkish-recipes.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/api/nutrition/search/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/nutrition/barcode/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/nutrition/recipes/[slug]/route.ts", import.meta.url), "utf8"),
  ]);
  for (const table of ["nutrition_sources", "recipe_dishes", "recipe_versions", "recipe_ingredients", "recipe_calculation_runs"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(migration, /unique \(dish_id, version\)/);
  assert.match(migration, /turkomp[\s\S]*true, false, 'manual_reference_after_permission'/);
  assert.match(migration, /open_food_facts[\s\S]*barcode_packaged_products_only/);
  assert.match(importer, /onConflict: "slug"/);
  assert.match(importer, /onConflict: "dish_id,version"/);
  assert.match(importer, /onConflict: "recipe_version_id,data_fingerprint"/);
  assert.doesNotMatch(searchRoute, /searchOpenFoodFacts/);
  assert.match(barcodeRoute, /findOpenFoodFactsBarcode/);
  assert.match(detailRoute, /const \{ slug \} = await params/);
  assert.match(detailRoute, /grams !== undefined && portions !== undefined/);
});
