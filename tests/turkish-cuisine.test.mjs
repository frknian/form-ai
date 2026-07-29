import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateRecipeNutrition, nutritionForRecipeAmount } from "../lib/recipe-nutrition.ts";

test("Türk mutfağı kataloğu en az 1.000 benzersiz ad içerir", async () => {
  const payload = JSON.parse(await readFile(
    new URL("../data/turkish-cuisine/turkish-cuisine-1000.json", import.meta.url),
    "utf8",
  ));
  assert.ok(payload.recipes.length >= 1_000);
  assert.equal(new Set(payload.recipes.map((recipe) => recipe.name)).size, payload.recipes.length);
  assert.ok(payload.recipes.every((recipe) => recipe.ingredients.length >= 2));
  assert.ok(payload.recipes.every((recipe) => recipe.needsReview === true));
});

test("kaynakta olmayan 100 gram besinleri katalogda uydurulmaz", async () => {
  const payload = JSON.parse(await readFile(
    new URL("../data/turkish-cuisine/turkish-cuisine-1000.json", import.meta.url),
    "utf8",
  ));
  assert.ok(payload.recipes.every((recipe) => recipe.nutritionPer100g === null));
  assert.ok(payload.recipes
    .filter((recipe) => !recipe.nutritionPerServing)
    .every((recipe) => recipe.nutritionBasis === "pending_ingredient_calculation"));
});

test("tarif hesabı pişmiş ağırlık üzerinden toplam, 100 g ve porsiyonu hesaplar", () => {
  const result = calculateRecipeNutrition({
    recipeSlug: "ornek-corba",
    recipeVersion: "1.0.0",
    cookedWeightGrams: 400,
    defaultPortionGrams: 200,
    ingredients: [{
      name: "örnek malzeme",
      rawWeightGrams: 200,
      nutrition: {
        caloriesPer100g: 100,
        proteinPer100g: 10,
        carbohydratesPer100g: 15,
        fatPer100g: 2,
        fiberPer100g: 3,
        source: "test",
        confidence: "high",
      },
    }],
  });
  assert.deepEqual(result.total, { calories: 200, protein: 20, carbohydrates: 30, fat: 4, fiber: 6 });
  assert.deepEqual(result.per100g, { calories: 50, protein: 5, carbohydrates: 7.5, fat: 1, fiber: 1.5 });
  assert.deepEqual(result.perPortion, { calories: 100, protein: 10, carbohydrates: 15, fat: 2, fiber: 3 });
  assert.equal(result.calculationMethod, "provider_energy");
  assert.equal(result.needsReview, false);
});

test("enerji eksikse Atwater yalnız tahmin olarak işaretlenir", () => {
  const result = calculateRecipeNutrition({
    recipeSlug: "ornek",
    recipeVersion: "1",
    cookedWeightGrams: 100,
    defaultPortionGrams: 50,
    ingredients: [{
      name: "malzeme",
      rawWeightGrams: 100,
      nutrition: {
        caloriesPer100g: null,
        proteinPer100g: 10,
        carbohydratesPer100g: 20,
        fatPer100g: 5,
        fiberPer100g: 2,
        source: "test",
        confidence: "high",
      },
    }],
  });
  assert.equal(result.total.calories, 165);
  assert.equal(result.calculationMethod, "atwater_estimate");
  assert.equal(result.confidence, "low");
  assert.equal(result.needsReview, true);
});

test("gram ve porsiyon seçimi aynı besin temelini ölçekler", () => {
  const per100g = { calories: 120, protein: 8, carbohydrates: 15, fat: 4, fiber: 3 };
  assert.deepEqual(
    nutritionForRecipeAmount(per100g, { portions: 2, defaultPortionGrams: 150 }),
    nutritionForRecipeAmount(per100g, { grams: 300, defaultPortionGrams: 150 }),
  );
});

test("migration tarif, malzeme, geçmiş ve fuzzy aramayı kurar", async () => {
  const sql = await readFile(new URL("../db/migrations/20260803_turkish_cuisine_catalog.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.cuisine_recipes/i);
  assert.match(sql, /create table if not exists public\.cuisine_recipe_ingredients/i);
  assert.match(sql, /create table if not exists public\.cuisine_recipe_calculations/i);
  assert.match(sql, /gin_trgm_ops/i);
  assert.match(sql, /search_cuisine_recipes/i);
  assert.match(sql, /catalog_status in \('pending', 'published'\)/i);
});
