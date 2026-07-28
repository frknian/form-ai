import assert from "node:assert/strict";
import test from "node:test";
import { mergeFoodResults, normalizeFoodSearchText, openFoodFactsHitToFood, scaleFoodNutrition, searchLocalFoods } from "../lib/food-search.ts";

test("Türkçe besin araması karakter farklarına dayanıklıdır", () => {
  assert.equal(normalizeFoodSearchText("Yoğurtlu Çorba"), "yogurtlu corba");
  assert.ok(searchLocalFoods("yogurt").some((food) => food.name.includes("Yoğurt")));
  assert.ok(searchLocalFoods("tavuk").some((food) => food.name.includes("Tavuk")));
  assert.ok(searchLocalFoods("makarna").some((food) => food.name.includes("Makarna") || food.name.includes("makarna")));
  assert.ok(searchLocalFoods("menemen").some((food) => food.name === "Menemen"));
  assert.equal(searchLocalFoods("sucuklu yumurta")[0]?.name, "Sucuklu yumurta");
  assert.equal(searchLocalFoods("sucuk yumurta")[0]?.name, "Sucuklu yumurta");
  assert.ok(searchLocalFoods("pastirma yumurta").some((food) => food.name === "Pastırmalı yumurta"));
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
  assert.ok(local.length >= 1);
  // Aynı ürünün uzak kaynaktan gelen kopyası sonucu büyütmemeli. Katalog
  // büyüdükçe local uzunluğu değişebileceği için sabit sayı yerine
  // "birleştirme sonrası artış olmadı" kontrolü yapılıyor.
  const duplicate = { ...local[0], id: "remote-yulaf", source: "Open Food Facts" };
  assert.equal(mergeFoodResults(local, [duplicate]).length, local.length);
});

test("yerel besin kataloğu tüm ana kategorileri kapsar ve tutarlıdır", () => {
  const kategoriler = {
    "Türk yemeği": ["lahmacun", "mantı", "iskender", "menemen", "kısır"],
    "Avrupa yemeği": ["pizza", "lazanya", "risotto", "kruvasan", "schnitzel"],
    "Atıştırmalık": ["cips", "çikolata", "kraker", "leblebi", "fındık"],
    "İçecek": ["kola", "ayran", "latte", "bira", "portakal suyu"],
    "Tatlı": ["baklava", "künefe", "sütlaç", "tiramisu", "dondurma"],
  };
  for (const [kategori, sorgular] of Object.entries(kategoriler)) {
    for (const sorgu of sorgular) assert.ok(searchLocalFoods(sorgu, 3).length > 0, `${kategori}: "${sorgu}" bulunamadı`);
  }
  // Makro tutarlılığı: protein*4 + karb*4 + yağ*9 kaloriye yakın olmalı.
  for (const sorgu of ["baklava", "pizza", "kola", "lahmacun", "tiramisu", "hamburger"]) {
    for (const food of searchLocalFoods(sorgu, 3)) {
      const { calories, protein, carbs, fat } = food.nutritionPer100g;
      const hesaplanan = protein * 4 + carbs * 4 + fat * 9;
      if (calories === 0) continue;
      assert.ok(Math.abs(hesaplanan - calories) <= Math.max(35, calories * 0.25), `${food.name}: ${calories} kcal beyan, ${Math.round(hesaplanan)} kcal makro`);
    }
  }
});
