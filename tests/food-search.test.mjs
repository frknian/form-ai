import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeFoodResults,
  normalizeFoodSearchText,
  openFoodFactsHitToFood,
  scaleFoodNutrition,
} from "../lib/food-search.ts";

const result = (overrides = {}) => ({
  id: crypto.randomUUID(),
  name: "Süzme Yoğurt",
  brand: "Örnek",
  servingGrams: 150,
  nutritionPer100g: { calories: 100, protein: 10, carbs: 8, fat: 3, fiber: 0, micros: {} },
  source: "FİT.AI besin veritabanı",
  dataQuality: "provider",
  ...overrides,
});

test("Türkçe normalizasyon karakter ve noktalama farklarını kaldırır", () => {
  assert.equal(normalizeFoodSearchText("  YOĞURTLU, Çorba!  "), "yogurtlu corba");
  assert.equal(normalizeFoodSearchText("Fırın Makarna"), "firin makarna");
  assert.equal(normalizeFoodSearchText("İçli Köfte"), "icli kofte");
});

test("Open Food Facts barkod sonucu güvenli biçimde ürüne çevrilir", () => {
  const product = openFoodFactsHitToFood({
    code: "5000159484480",
    product_name: "Snickers",
    brands: ["Mars", "Snickers"],
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
  assert.equal(product?.nutritionPer100g?.micros.sodiumMg, 176);
  assert.equal(product?.source, "Open Food Facts");
});

test("geçersiz sağlayıcı kaydı katalog sonucu üretmez", () => {
  assert.equal(openFoodFactsHitToFood({ product_name: "Eksik enerji", nutriments: {} }), null);
  assert.equal(openFoodFactsHitToFood({ nutriments: { "energy-kcal_100g": 100 } }), null);
});

test("gram değişiminde makro ve mikro değerleri orantılı ölçeklenir", () => {
  const scaled = scaleFoodNutrition(
    { calories: 100, protein: 10, carbs: 20, fat: 5, fiber: 4, micros: { calciumMg: 120 } },
    150,
  );
  assert.deepEqual(scaled, {
    calories: 150,
    protein: 15,
    carbs: 30,
    fat: 7.5,
    fiber: 6,
    micros: { calciumMg: 180 },
  });
});

test("birleştirme barkod ve normalize adla tekrarları kaldırır", () => {
  const primary = result({ id: "local", barcode: "123", matchScore: 0.8 });
  const duplicate = result({ id: "remote", barcode: "123", matchScore: 0.7 });
  const sameName = result({ id: "other-source", barcode: undefined });
  assert.deepEqual(mergeFoodResults([primary], [duplicate]), [primary]);
  assert.equal(mergeFoodResults([sameName], [result({ id: "same-name", barcode: undefined })]).length, 1);
});

test("kişiselleştirilmiş sonuç üstte tutulur", () => {
  const ordinary = result({ id: "ordinary", name: "Yoğurt", brand: undefined, matchScore: 0.95 });
  const preferred = result({ id: "preferred", name: "Ev Yoğurdu", brand: undefined, matchScore: 0.7, personalized: true });
  assert.equal(mergeFoodResults([ordinary, preferred], [])[0].id, "preferred");
});

test("aynı adlı doğrulanmış besin, inceleme bekleyen tariften önce gelir", () => {
  const verified = result({ id: "verified", name: "Mercimek Çorbası", brand: undefined, matchScore: 0.7 });
  const pending = result({
    id: "pending",
    name: "Mercimek Çorbası",
    brand: undefined,
    nutritionPer100g: null,
    nutritionPerServing: { calories: 180, protein: 8, carbs: 25, fat: 5, fiber: 6, micros: {} },
    matchScore: 1,
  });
  assert.equal(mergeFoodResults([pending], [verified])[0].id, "verified");
});
