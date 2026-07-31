import assert from "node:assert/strict";
import test from "node:test";
import { fromGrams, parseAmount, toGrams } from "../lib/portion-unit.ts";

test("miktar ayrıştırma virgüllü ondalığı kabul eder", () => {
  assert.equal(parseAmount("1,5"), 1.5);
  assert.equal(parseAmount("200"), 200);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("0"), null);
  assert.equal(parseAmount("-3"), null);
  assert.equal(parseAmount("abc"), null);
});

test("gram birimi olduğu gibi kullanılır", () => {
  assert.equal(toGrams("250", "g", null), 250);
  assert.equal(toGrams("250", "g", 60), 250, "gram modunda adet ağırlığı yok sayılır");
});

test("adet, bir adedin gramıyla çarpılır", () => {
  assert.equal(toGrams("3", "piece", 60), 180);
  assert.equal(toGrams("1,5", "piece", 200), 300);
});

test("adet ağırlığı bilinmiyorsa gram üretilmez", () => {
  // Uydurma bir ağırlıkla devam etmek sessizce yanlış kalori kaydeder.
  assert.equal(toGrams("2", "piece", null), null);
  assert.equal(toGrams("2", "piece", 0), null);
});

test("birim değişince miktar karşılığına çevrilir", () => {
  assert.equal(fromGrams(180, "g", 60), "180");
  assert.equal(fromGrams(180, "piece", 60), "3");
  assert.equal(fromGrams(300, "piece", 200), "1.5");
  assert.equal(fromGrams(180, "piece", null), "", "ağırlık bilinmeden adet gösterilemez");
});

test("gidiş dönüş dönüşümü tutarlıdır", () => {
  const grams = toGrams(fromGrams(240, "piece", 80), "piece", 80);
  assert.equal(grams, 240);
});

test("öğün alanları mobilde ızgarayı taşırmaz", async () => {
  const { readFile } = await import("node:fs/promises");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  // 1fr'in örtük alt sınırı auto'dur; uzun yemek adı sütunu kabın dışına
  // genişletip yatay kaydırma yaratıyordu. Tüm izler minmax(0,1fr) olmalı.
  const rules = [...css.matchAll(/\.manual-fields \{ grid-template-columns:([^;]+);/g)].map((m) => m[1]);
  assert.ok(rules.length >= 3, `beklenenden az kural: ${rules.length}`);
  for (const rule of rules) {
    // minmax(0,1fr) doğrudur; yalnız korumasız kalan 1fr izleri aranır.
    const bare = rule.replace(/minmax\([^)]*\)/g, "");
    assert.doesNotMatch(bare, /\b1fr/, `korumasız 1fr taşmaya yol açar: ${rule}`);
  }
  assert.match(css, /\.ai-estimate-card strong[^{]*\{[^}]*overflow-wrap:anywhere/);
});
