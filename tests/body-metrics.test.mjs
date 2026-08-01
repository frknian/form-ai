import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  BMI_BOUNDARIES,
  DEFAULT_HEIGHT_CM,
  DEFAULT_WEIGHT_KG,
  HEIGHT_RANGE,
  WEIGHT_RANGE,
  bmiCategory,
  bmiScalePercent,
  bodyMassIndex,
  clampToRange,
  rangePercent,
  readMeasure,
  silhouettePercent,
} from "../lib/body-metrics.ts";
import { GOAL_PRESETS, matchGoalPreset } from "../lib/goal-presets.ts";

test("aralık dışındaki değerler kırpılır", () => {
  assert.equal(clampToRange(400, HEIGHT_RANGE), 220);
  assert.equal(clampToRange(10, HEIGHT_RANGE), 120);
  assert.equal(clampToRange(173.6, HEIGHT_RANGE), 174, "ondalık en yakın tam sayıya yuvarlanır");
  assert.equal(clampToRange(Number.NaN, WEIGHT_RANGE), WEIGHT_RANGE.min);
});

test("metin kutusundan gelen değer güvenle okunur", () => {
  // Değerler uygulamada dize taşınır; boş/bozuk olan varsayılana düşmeli,
  // yoksa kaydırıcı NaN konumuna gidip görünmez olurdu.
  assert.equal(readMeasure("", HEIGHT_RANGE, DEFAULT_HEIGHT_CM), DEFAULT_HEIGHT_CM);
  assert.equal(readMeasure("abc", WEIGHT_RANGE, DEFAULT_WEIGHT_KG), DEFAULT_WEIGHT_KG);
  assert.equal(readMeasure("0", WEIGHT_RANGE, DEFAULT_WEIGHT_KG), DEFAULT_WEIGHT_KG);
  assert.equal(readMeasure("182", HEIGHT_RANGE, DEFAULT_HEIGHT_CM), 182);
  assert.equal(readMeasure("72,5", WEIGHT_RANGE, DEFAULT_WEIGHT_KG), 73, "virgüllü giriş de okunmalı");
  assert.equal(readMeasure("999", HEIGHT_RANGE, DEFAULT_HEIGHT_CM), 220, "kaydedilmiş uçuk değer kırpılır");
});

test("kaydırıcı dolu oranı uçlarda 0 ve 100 olur", () => {
  assert.equal(rangePercent(HEIGHT_RANGE.min, HEIGHT_RANGE), 0);
  assert.equal(rangePercent(HEIGHT_RANGE.max, HEIGHT_RANGE), 100);
  assert.equal(rangePercent(170, HEIGHT_RANGE), 50);
});

test("silüet en kısa boyda bile görünür kalır ve boyla birlikte büyür", () => {
  // Doğrudan yüzdeyi kullanmak 120 cm'i sıfır yükseklikte, yani görünmez
  // bir çizgi yapardı.
  const shortest = silhouettePercent(HEIGHT_RANGE.min);
  const tallest = silhouettePercent(HEIGHT_RANGE.max);
  assert.ok(shortest >= 50, `en kısa silüet çok küçük: ${shortest}`);
  assert.equal(tallest, 100);
  assert.ok(silhouettePercent(170) > shortest && silhouettePercent(170) < tallest, "orta boy arada olmalı");
});

test("VKİ hesabı ve kategorileri WHO sınırlarına uyar", () => {
  assert.equal(bodyMassIndex(180, 81), 25);
  assert.equal(bodyMassIndex(170, 70), 24.2);
  assert.equal(bodyMassIndex(0, 70), null, "sıfır boy bölme hatası vermemeli");
  assert.equal(bodyMassIndex(170, 0), null);

  assert.equal(bmiCategory(18.4), "underweight");
  assert.equal(bmiCategory(18.5), "normal", "sınır değer üst kategoriye ait");
  assert.equal(bmiCategory(24.9), "normal");
  assert.equal(bmiCategory(25), "overweight");
  assert.equal(bmiCategory(29.9), "overweight");
  assert.equal(bmiCategory(30), "obese");
});

test("VKİ göstergesi ölçek dışına taşmaz", () => {
  assert.equal(bmiScalePercent(15), 0);
  assert.equal(bmiScalePercent(40), 100);
  assert.equal(bmiScalePercent(9), 0, "aşırı düşük değer çubuğun dışına çıkmamalı");
  assert.equal(bmiScalePercent(90), 100);
  assert.equal(BMI_BOUNDARIES.length, 3);
  // Sınır işaretleri artan sırada ve çubuğun içinde olmalı.
  for (const boundary of BMI_BOUNDARIES) {
    assert.ok(boundary.percent > 0 && boundary.percent < 100, `sınır çubuk dışında: ${boundary.value}`);
  }
});

test("hedef kartları plan üretiminin okuduğu anahtar kelimeleri taşır", async () => {
  // app/api/generate-plan primaryGoal'ü bu kelimelerle eşleştirir; kart metni
  // değişirse hedef sessizce "Güçlenme"ye düşerdi.
  const byId = Object.fromEntries(GOAL_PRESETS.map((preset) => [preset.id, preset.text.toLocaleLowerCase("tr-TR")]));
  assert.match(byId.lose, /kilo/);
  assert.match(byId.fat, /yağ/);
  assert.match(byId.muscle, /kas/);
  assert.match(byId.condition, /kondisyon/);
  // "Güçlenmek" bilinçli olarak hiçbir anahtar kelime taşımaz: eşleşme
  // zincirinin varsayılanı zaten "Güçlenme".
  assert.doesNotMatch(byId.strength, /kilo|yağ|kas|kondisyon/);

  const { profileSignals } = await import("../app/api/generate-plan/route.ts");
  assert.equal(profileSignals({ goal: byId.lose }).primaryGoal, "Kilo verme");
  assert.equal(profileSignals({ goal: byId.fat }).primaryGoal, "Kilo verme");
  assert.equal(profileSignals({ goal: byId.muscle }).primaryGoal, "Kas geliştirme");
  assert.equal(profileSignals({ goal: byId.condition }).primaryGoal, "Kondisyon");
  assert.equal(profileSignals({ goal: byId.strength }).primaryGoal, "Güçlenme");
});

test("hedef kartı seçimi yalnız tam eşleşmede işaretli kalır", () => {
  assert.equal(matchGoalPreset(GOAL_PRESETS[0].text), "lose");
  assert.equal(matchGoalPreset(` ${GOAL_PRESETS[0].text} `), "lose", "boşluklar seçimi düşürmemeli");
  assert.equal(matchGoalPreset(`${GOAL_PRESETS[0].text} Ayrıca koşmak istiyorum.`), null, "kullanıcı yazınca seçim düşer");
  assert.equal(matchGoalPreset(""), null);
});

test("her hedef kartının iki dilde de etiketi vardır", async () => {
  for (const file of ["../lib/i18n/dictionaries/tr.ts", "../lib/i18n/dictionaries/en.ts"]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    const block = source.slice(source.indexOf("goalPresets: {"), source.indexOf("goalPresets: {") + 400);
    for (const preset of GOAL_PRESETS) {
      assert.match(block, new RegExp(`\\b${preset.id}:`), `${file}: ${preset.id} etiketi eksik`);
    }
  }
});

test("ölçü seçicileri hızlı ardışık dokunuşta adım kaybetmez", async () => {
  // 10 kez "+" tek adım ilerletiyordu: her tıklayıcı aynı render'ın değerini
  // okuyup birbirini eziyordu. Güncelleyici biçim bunu engeller.
  const source = await readFile(new URL("../components/onboarding/BodyMetrics.tsx", import.meta.url), "utf8");
  assert.match(source, /setter\(\(previous\) => String\(clampToRange\(readMeasure\(previous/);
  assert.match(source, /onStep=\{stepBy\(onHeightChange, HEIGHT_RANGE, DEFAULT_HEIGHT_CM\)\}/);
  assert.match(source, /onStep=\{stepBy\(onWeightChange, WEIGHT_RANGE, DEFAULT_WEIGHT_KG\)\}/);
});
