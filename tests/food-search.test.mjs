import assert from "node:assert/strict";
import test from "node:test";
import { mergeFoodResults, normalizeFoodSearchText, openFoodFactsHitToFood, scaleFoodNutrition, searchLocalFoods } from "../lib/food-search.ts";

test("Türkçe besin araması karakter farklarına dayanıklıdır", () => {
  assert.equal(normalizeFoodSearchText("Yoğurtlu Çorba"), "yogurtlu corba");
  assert.ok(searchLocalFoods("yogurt").some((food) => food.name.includes("Yoğurt")));
  assert.ok(searchLocalFoods("tavuk").some((food) => food.name.includes("Tavuk")));
  assert.ok(searchLocalFoods("makarna").some((food) => food.name.includes("Makarna") || food.name.includes("makarna")));
  assert.ok(searchLocalFoods("menemen").some((food) => food.name === "Menemen"));
  assert.ok(searchLocalFoods("ekmek").length >= 2);
});

test("Snickers ve yaygın paketli atıştırmalıklar temel katalogda bulunur", () => {
  const snickers = searchLocalFoods("snickers")[0];
  assert.equal(snickers.name, "Snickers");
  assert.equal(snickers.brand, "Mars");
  assert.equal(snickers.servingGrams, 50);
  assert.equal(snickers.nutritionPer100g.calories, 510);
  assert.ok(searchLocalFoods("doritos").some((food) => food.name.includes("Doritos")));
  assert.ok(searchLocalFoods("ülker gofret").some((food) => food.name.includes("Gofret")));
});

test("Open Food Facts tam metin arama sonucu güvenli biçimde ürün sonucuna çevrilir", () => {
  const product = openFoodFactsHitToFood({
    code: "5000159484480",
    product_name: "Snickers",
    brands: ["Mars Snickers", "Snickers"],
    serving_size: "50 g",
    nutriments: {
      "energy-kcal_100g": 510,
      proteins_100g: 9.5,
      carbohydrates_100g: 54,
      fat_100g: 28,
      fiber_100g: 2.5,
      sodium_100g: 0.176,
    },
  });
  assert.equal(product?.name, "Snickers");
  assert.equal(product?.servingGrams, 50);
  assert.equal(product?.nutritionPer100g.micros.sodiumMg, 176);
  assert.equal(product?.source, "Open Food Facts");
});

test("porsiyon değişiminde makro, lif ve mikro değerleri orantılı günceller", () => {
  const scaled = scaleFoodNutrition({ calories: 100, protein: 10, carbs: 20, fat: 5, fiber: 4, micros: { calciumMg: 120, ironMg: 2 } }, 150);
  assert.equal(scaled.calories, 150);
  assert.equal(scaled.protein, 15);
  assert.equal(scaled.carbs, 30);
  assert.equal(scaled.fat, 7.5);
  assert.equal(scaled.fiber, 6);
  assert.equal(scaled.micros.calciumMg, 180);
  assert.equal(scaled.micros.ironMg, 3);
});

test("uzak ve yerel ürün sonuçlarını tekrar etmeden birleştirir", () => {
  const local = searchLocalFoods("yulaf");
  const duplicate = { ...local[0], id: "remote-yulaf", source: "Open Food Facts" };
  assert.equal(mergeFoodResults(local, [duplicate]).length, 1);
});
