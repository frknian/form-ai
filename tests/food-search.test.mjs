import assert from "node:assert/strict";
import test from "node:test";
import { mergeFoodResults, normalizeFoodSearchText, scaleFoodNutrition, searchLocalFoods } from "../lib/food-search.ts";

test("Türkçe besin araması karakter farklarına dayanıklıdır", () => {
  assert.equal(normalizeFoodSearchText("Yoğurtlu Çorba"), "yogurtlu corba");
  assert.ok(searchLocalFoods("yogurt").some((food) => food.name.includes("Yoğurt")));
  assert.ok(searchLocalFoods("tavuk").some((food) => food.name.includes("Tavuk")));
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
