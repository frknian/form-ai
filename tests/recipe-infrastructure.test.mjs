import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateRecipeNutrition, nutritionForRecipeAmount } from "../lib/recipe-nutrition.ts";
import { recipeRowToSearchResult } from "../lib/recipe-data.ts";
import { usdaFoodToIngredientBasis } from "../lib/providers/usda-food-data.ts";
import {
  CATEGORY_QUOTAS,
  buildCatalog,
  normalizeTurkish,
  searchCatalogRecords,
  validateCatalog,
  validateRecordConsistency,
} from "../scripts/turkish-food-catalog.mjs";

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

test("şeker ve sodyum değerleri pişmiş ağırlık ve porsiyona ölçeklenir", () => {
  const result = calculateRecipeNutrition({
    recipeSlug: "ornek",
    recipeVersion: "1",
    cookedWeightGrams: 200,
    defaultPortionGrams: 50,
    ingredients: [{
      ...rice,
      rawWeightGrams: 100,
      nutrition: { ...rice.nutrition, sugarPer100g: 4, sodiumMgPer100g: 120 },
    }],
  });
  assert.equal(result.per100g.sugar, 2);
  assert.equal(result.perPortion.sugar, 1);
  assert.equal(result.per100g.sodiumMg, 60);
  assert.equal(result.perPortion.sodiumMg, 30);
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

test("besin değeri eksik katalog kaydı 0 kcal olarak dönmez", () => {
  const result = recipeRowToSearchResult({
    slug: "analikizli",
    name: "Analı kızlı",
    category: "Çorbalar",
    confidence_level: "medium",
    calculation_method: "not_calculated",
    calories_per_100g: null,
  });
  assert.equal(result?.nutritionPer100g, null);
  assert.equal(result?.dataQuality, "incomplete");
});

test("Türkçe normalizasyon ve boşluk farkı aynı yemeği bulur", async () => {
  assert.equal(normalizeTurkish("ÇİĞ-Köfte"), "cig kofte");
  const manifest = JSON.parse(await readFile(new URL("../data/turkish-foods/source-manifest.json", import.meta.url), "utf8"));
  const catalog = buildCatalog(manifest);
  const direct = searchCatalogRecords(catalog, "cig kofte");
  const compact = searchCatalogRecords(catalog, "çiğköfte");
  assert.ok(direct.some((dish) => dish.slug === "cig-kofte"));
  assert.ok(compact.some((dish) => dish.slug === "cig-kofte"));
});

test("alternatif adla arama ana kaydı döndürür", () => {
  const dishes = [{
    name: "Batman Ayran Çorbası",
    alternativeNames: ["Mehir"],
  }];
  assert.equal(searchCatalogRecords(dishes, "mehir")[0]?.name, "Batman Ayran Çorbası");
});

test("500 yemeklik seed tekrarsız, kaynaklı ve besin açısından inceleme güvenlidir", async () => {
  const seed = JSON.parse(await readFile(new URL("../data/turkish-recipes.seed.json", import.meta.url), "utf8"));
  assert.equal(seed.dishes.length, 500);
  assert.equal(new Set(seed.dishes.map((dish) => dish.slug)).size, 500);
  assert.ok(seed.dishes.filter((dish) => dish.isLesserKnown).length >= 200);
  for (const dish of seed.dishes) {
    assert.ok(Array.isArray(dish.ingredients));
    assert.ok(dish.sources.length >= 1);
    assert.equal(dish.needsReview, true);
    assert.equal(dish.nutritionPer100g, null);
    assert.equal(dish.nutritionPerServing, null);
  }
});

test("eşdeğer yemek adları tek kayıtta birleşir, gerçek sucuk çeşitlerinin farkı açıklanır", async () => {
  const seed = JSON.parse(await readFile(new URL("../data/turkish-recipes.seed.json", import.meta.url), "utf8"));
  const etliEkmek = seed.dishes.filter((dish) => ["etli-ekmek", "etliekmek"].includes(dish.slug));
  assert.equal(etliEkmek.length, 1);
  assert.deepEqual(new Set(etliEkmek[0].province), new Set(["Mardin", "Konya"]));
  assert.ok(etliEkmek[0].alternativeNames.includes("ETLİEKMEK"));
  assert.ok(etliEkmek[0].mergedDishSlugs.includes("etliekmek"));
  assert.equal(seed.dishes.filter((dish) => ["alaca-corba", "alaca-corbasi"].includes(dish.slug)).length, 1);
  assert.equal(seed.dishes.filter((dish) => ["sor-tuzlu-balik", "tuzlu-balik"].includes(dish.slug)).length, 1);

  const sucuk = seed.dishes.find((dish) => dish.slug === "sucuk");
  const sucukIci = seed.dishes.find((dish) => dish.slug === "sucuk-ici");
  const pestilSucugu = seed.dishes.find((dish) => dish.slug === "pestil-ve-sucuklar");
  assert.equal(sucukIci.parentDishId, sucuk.id);
  assert.match(sucukIci.variantReason, /kılıfsız/);
  assert.match(pestilSucugu.variantReason, /et ürünü değildir/);
});

test("kategori kotaları, yedi bölge ve 81 il doğrulaması geçer", async () => {
  const [seed, report] = await Promise.all([
    readFile(new URL("../data/turkish-recipes.seed.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../data/turkish-foods/quality-report.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  const calculated = validateCatalog(seed.dishes);
  assert.equal(calculated.valid, true);
  for (const [category, quota] of Object.entries(CATEGORY_QUOTAS)) {
    assert.ok(report.categoryDistribution[category] >= quota, `${category} kotası`);
  }
  assert.equal(Object.keys(report.regionDistribution).length, 7);
  assert.ok(Object.values(report.regionDistribution).every((count) => count > 0));
  assert.equal(report.representedProvinceCount, 81);
  assert.deepEqual(report.missingProvinces, []);
  assert.deepEqual(report.probableDuplicates, []);
  assert.equal(report.mergedEquivalentDishes.length, 3);
});

test("slug upsert anahtarı seed tekrarında kayıt sayısını artırmaz", async () => {
  const seed = JSON.parse(await readFile(new URL("../data/turkish-recipes.seed.json", import.meta.url), "utf8"));
  const simulatedTable = new Map();
  for (const run of [seed.dishes, seed.dishes]) {
    for (const dish of run) simulatedTable.set(dish.slug, dish);
  }
  assert.equal(simulatedTable.size, 500);
});

test("vegan, alerjen ve ebeveyn-çeşit tutarlılığı doğrulanır", () => {
  const parent = { id: "parent", slug: "parent", name: "Ana yemek", mainIngredients: [], ingredients: [], allergens: [] };
  const invalidVegan = { id: "vegan", slug: "vegan", name: "Tavuklu vegan örnek", dietaryType: "vegan", mainIngredients: ["tavuk"], ingredients: [], allergens: [] };
  assert.match(validateRecordConsistency(invalidVegan, new Set()).join(" "), /vegan etiketi/);
  const missingAllergen = { id: "milk", slug: "milk", name: "Yoğurtlu örnek", dietaryType: "vegetarian", mainIngredients: ["yoğurt"], ingredients: [], allergens: [] };
  assert.match(validateRecordConsistency(missingAllergen, new Set()).join(" "), /süt alerjeni/);
  const validVariant = { id: "variant", slug: "variant", name: "Yöresel çeşit", mainIngredients: [], ingredients: [], allergens: [], parentDishId: parent.id, variantReason: "Pişirme yöntemi farklıdır." };
  assert.deepEqual(validateRecordConsistency(validVariant, new Set([parent.id])), []);
  assert.match(validateRecordConsistency({ ...validVariant, variantReason: null }, new Set([parent.id])).join(" "), /çeşitleme nedeni/);
});

test("migration geniş veri modeli ve filtreleri; import idempotency ve manuel veri korumasını içerir", async () => {
  const [baseMigration, expansionMigration, importer, searchRoute, barcodeRoute, detailRoute] = await Promise.all([
    readFile(new URL("../db/migrations/20260730_turkish_recipe_infrastructure.sql", import.meta.url), "utf8"),
    readFile(new URL("../db/migrations/20260731_turkish_food_catalog_expansion.sql", import.meta.url), "utf8"),
    readFile(new URL("../scripts/import-turkish-recipes.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/api/nutrition/search/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/nutrition/barcode/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/nutrition/recipes/[slug]/route.ts", import.meta.url), "utf8"),
  ]);
  for (const table of ["nutrition_sources", "recipe_dishes", "recipe_versions", "recipe_ingredients", "recipe_calculation_runs"]) {
    assert.match(baseMigration, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(baseMigration, /unique \(dish_id, version\)/);
  assert.match(baseMigration, /turkomp[\s\S]*true, false, 'manual_reference_after_permission'/);
  assert.match(baseMigration, /open_food_facts[\s\S]*barcode_packaged_products_only/);
  for (const column of ["normalized_name", "regions", "provinces", "main_ingredients", "cooking_methods", "dietary_type", "is_lesser_known", "parent_dish_id", "sugar_per_100g", "sodium_mg_per_100g"]) {
    assert.match(expansionMigration, new RegExp(column));
  }
  assert.match(importer, /onConflict: "slug"/);
  assert.match(importer, /onConflict: "dish_id,version"/);
  assert.match(importer, /manuallyCurated/);
  assert.match(importer, /parent_dish_id/);
  assert.match(importer, /catalog_status: "archived"/);
  assert.match(importer, /argumentValue\("category"\)/);
  assert.match(importer, /argumentValue\("region"\)/);
  assert.doesNotMatch(searchRoute, /searchOpenFoodFacts/);
  assert.match(searchRoute, /nutritionVerified/);
  assert.match(barcodeRoute, /findOpenFoodFactsBarcode/);
  assert.match(detailRoute, /const \{ slug \} = await params/);
  assert.match(detailRoute, /grams !== undefined && portions !== undefined/);
});
