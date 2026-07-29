import assert from "node:assert/strict";
import test from "node:test";
import { emptyFoodNutrition, scaleFoodNutrition } from "../lib/food-search.ts";

test("boş besin formu tüm değerleri güvenli olarak sıfırlar", () => {
  assert.deepEqual(emptyFoodNutrition(), {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    micros: {},
  });
});

test("AI değerleri kullanıcı gramajı değiştirince orantılı uygulanır", () => {
  const scaled = scaleFoodNutrition({
    calories: 100,
    protein: 10,
    carbs: 20,
    fat: 5,
    fiber: 4,
    micros: { calciumMg: 120, ironMg: 2 },
  }, 150);
  assert.equal(scaled.calories, 150);
  assert.equal(scaled.protein, 15);
  assert.equal(scaled.carbs, 30);
  assert.equal(scaled.fat, 7.5);
  assert.equal(scaled.fiber, 6);
  assert.equal(scaled.micros.calciumMg, 180);
  assert.equal(scaled.micros.ironMg, 3);
});
