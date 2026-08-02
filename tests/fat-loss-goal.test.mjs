import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { calculateNutritionGoal, inferNutritionGoal, isDeficitGoal, sanitizeNutritionGoal } from "../lib/nutrition-goals.ts";
import { weeklyGoalCategory } from "../lib/weekly-review.ts";

const context = { bmr: 1700, tdee: 2400, weightKg: 90, activityFactor: 1.4, workoutDays: 4 };

test("yağ kaybı kilo vermeden ayrı bir hedef olarak okunur", () => {
  // Eskiden ikisi de "lose" dönüyordu: kullanıcı arayüzde ayrı iki seçenek
  // görüyor ama içeride hiçbir fark oluşmuyordu.
  assert.equal(inferNutritionGoal("Yağ oranımı düşürmek"), "fatLoss");
  assert.equal(inferNutritionGoal("Yağ oranımı düşürüp daha tanımlı görünmek istiyorum."), "fatLoss");
  assert.equal(inferNutritionGoal("Kilo vermek"), "lose");
  assert.equal(inferNutritionGoal("Kas geliştirmek"), "gain");
  assert.equal(inferNutritionGoal("Sağlıklı kalmak"), "maintain");
});

test("yağ kaybında açık daha küçük, protein daha yüksek", () => {
  const fatLoss = calculateNutritionGoal({ ...context, goalType: "fatLoss" });
  const lose = calculateNutritionGoal({ ...context, goalType: "lose" });

  // Sert açık kaybın kas payını büyütür; yağ kaybı modu bilerek daha ılımlı.
  assert.ok(fatLoss.calorieAdjustment < 0, "yağ kaybı da açık üretmeli");
  assert.ok(fatLoss.calorieAdjustment > lose.calorieAdjustment, `açık kilo vermeden küçük olmalı: ${fatLoss.calorieAdjustment} vs ${lose.calorieAdjustment}`);
  assert.ok(fatLoss.calorieTarget > lose.calorieTarget);

  // Açıktayken kası koruyan asıl değişken protein.
  assert.ok(fatLoss.proteinGrams > lose.proteinGrams, `protein daha yüksek olmalı: ${fatLoss.proteinGrams} vs ${lose.proteinGrams}`);
  assert.equal(fatLoss.proteinGrams, Math.round(context.weightKg * 2.2));
});

test("yağ kaybı hedefi de BMR'nin altına inmez", () => {
  const aggressive = calculateNutritionGoal({ goalType: "fatLoss", bmr: 2000, tdee: 2100, weightKg: 90, activityFactor: 1.2, workoutDays: 3 });
  assert.ok(aggressive.calorieTarget >= aggressive.bmr, "hedef BMR'nin altına düşmemeli");
  assert.equal(isDeficitGoal("fatLoss"), true);
  assert.equal(isDeficitGoal("maintain"), false);
});

test("kaydedilmiş yağ kaybı hedefi geri okunabilir", () => {
  const saved = calculateNutritionGoal({ ...context, goalType: "fatLoss" });
  const restored = sanitizeNutritionGoal({ ...saved });
  assert.equal(restored?.goalType, "fatLoss");
});

test("haftalık değerlendirme yağ kaybını ayrı kategoride görür", () => {
  assert.equal(weeklyGoalCategory("Yağ oranımı düşürmek"), "Yağ kaybı");
  assert.equal(weeklyGoalCategory("Kilo vermek"), "Kilo verme");
  assert.equal(weeklyGoalCategory("Kas geliştirmek"), "Kas geliştirme");
});

test("düz tartı yağ kaybında başarısızlık sayılmaz", async () => {
  const { weightTrendAdvice } = await import("../lib/nutrition-goals.ts");
  const { tr } = await import("../lib/i18n/dictionaries/tr.ts");
  const flat = { weeklyKg: 0, weeklyPercent: 0, days: 14 };
  // Aynı anda kas kazanılıyorsa yağ kaybı tartıya yansımaz; kullanıcı
  // "ilerlemiyorum" sanıp açığı büyütmemeli.
  assert.equal(weightTrendAdvice(flat, "fatLoss", tr), tr.nutritionGoals.trendFatLossFlat);
  assert.notEqual(weightTrendAdvice(flat, "fatLoss", tr), weightTrendAdvice(flat, "lose", tr));
  // Çok hızlı düşüş yağ kaybında da uyarı üretir.
  assert.equal(weightTrendAdvice({ weeklyKg: -1.5, weeklyPercent: -1.6, days: 14 }, "fatLoss", tr), tr.nutritionGoals.trendFatLossTooFast);
});

test("plan üretimi yağ kaybında direnç antrenmanını korur", async () => {
  const route = await readFile(new URL("../app/api/generate-plan/route.ts", import.meta.url), "utf8");
  assert.match(route, /goal\.includes\("yağ"\) \|\| goal\.includes\("tanımlı"\) \? "Yağ kaybı"/);
  // Yağ kaybını saf kardiyoya çevirmek kası eritir; istem bunu açıkça yasaklar.
  assert.match(route, /YAĞ KAYBI KURALI: Programı sadece kardiyoya çevirme/);
});

test("yağ kaybı arayüzde dördüncü seçenek olarak sunulur", async () => {
  const [panel, dictTr, dictEn] = await Promise.all([
    readFile(new URL("../components/NutritionGoalsPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/i18n/dictionaries/tr.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/i18n/dictionaries/en.ts", import.meta.url), "utf8"),
  ]);
  assert.match(panel, /\["lose", "fatLoss", "maintain", "gain"\]/);
  assert.match(panel, /fatLoss: t\.nutritionGoals\.fatLossHint/);
  for (const dict of [dictTr, dictEn]) {
    for (const key of ["goalFatLoss", "fatLossHint", "trendFatLossFlat", "trendFatLossOk", "trendFatLossTooFast", "trendFatLossGaining"]) {
      assert.match(dict, new RegExp(`\\b${key}:`), `${key} eksik`);
    }
  }
});
