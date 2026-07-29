import assert from "node:assert/strict";
import test from "node:test";
import { frequentMeals } from "../lib/frequent-meals.ts";

const TODAY = "2026-07-28";
const day = (offset) => new Date(Date.parse(`${TODAY}T09:00:00.000Z`) - offset * 86_400_000).toISOString();
const meal = (name, mealType, offset, calories = 300) => ({
  name, meal: mealType, calories, protein: 10, carbs: 30, fat: 8, consumedAt: day(offset),
});

test("en sık yenen öğün başa gelir", () => {
  const result = frequentMeals([
    meal("Yulaf ezmesi", "Kahvaltı", 1), meal("Yulaf ezmesi", "Kahvaltı", 2), meal("Yulaf ezmesi", "Kahvaltı", 3),
    meal("Mercimek çorbası", "Öğle yemeği", 4),
  ], { today: TODAY });
  assert.equal(result[0].entry.name, "Yulaf ezmesi");
  assert.equal(result[0].count, 3);
});

test("aynı ad farklı öğünde ayrı sayılır", () => {
  const result = frequentMeals([meal("Yumurta", "Kahvaltı", 1), meal("Yumurta", "Akşam yemeği", 2)], { today: TODAY });
  assert.equal(result.length, 2);
});

test("büyük/küçük harf ve fazladan boşluk aynı öğün sayılır", () => {
  const result = frequentMeals([
    meal("Yulaf Ezmesi", "Kahvaltı", 1), meal("  yulaf   ezmesi ", "Kahvaltı", 2),
  ], { today: TODAY });
  assert.equal(result.length, 1);
  assert.equal(result[0].count, 2);
});

test("bugünkü kayıtlar önerilmez", () => {
  // Ekranda zaten duran öğünü tekrar önermek gürültü olurdu.
  const result = frequentMeals([meal("Ayran", "Atıştırmalık", 0)], { today: TODAY });
  assert.deepEqual(result, []);
});

test("30 günden eski kayıtlar sayılmaz", () => {
  const result = frequentMeals([meal("Eski öğün", "Kahvaltı", 45), meal("Yeni öğün", "Kahvaltı", 5)], { today: TODAY });
  assert.equal(result.length, 1);
  assert.equal(result[0].entry.name, "Yeni öğün");
});

test("eşit tekrarda daha yeni olan öne geçer", () => {
  const result = frequentMeals([meal("A", "Kahvaltı", 10), meal("B", "Kahvaltı", 2)], { today: TODAY });
  assert.equal(result[0].entry.name, "B");
});

test("temsilci kayıt en güncel olandır", () => {
  // Porsiyon/makro zamanla düzeltilmiş olabilir; eski değeri kopyalamak yanlış olur.
  const result = frequentMeals([meal("Tost", "Kahvaltı", 5, 250), meal("Tost", "Kahvaltı", 1, 400)], { today: TODAY });
  assert.equal(result[0].entry.calories, 400);
});

test("limit uygulanır", () => {
  const entries = ["a", "b", "c", "d"].map((name, index) => meal(name, "Kahvaltı", index + 1));
  assert.equal(frequentMeals(entries, { today: TODAY, limit: 2 }).length, 2);
});
