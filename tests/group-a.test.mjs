import assert from "node:assert/strict";
import test from "node:test";
import { detectNewPersonalRecords } from "../lib/personal-records.ts";
import { alternativeExercises } from "../lib/exercise-alternatives.ts";

const at = "2026-07-28T10:00:00.000Z";
const s = (exerciseKey, weightKg, reps, exerciseName = exerciseKey) => ({ exerciseKey, exerciseName, completedAt: at, weightKg, reps });

test("ilk ağırlıklı kayıt rekor sayılır ve işaretlenir", () => {
  const records = detectNewPersonalRecords([s("goblet_squat", 40, 10)], []);
  assert.equal(records.length, 1);
  assert.equal(records[0].isFirstRecord, true);
  assert.equal(records[0].previousOneRepMaxKg, 0);
});

test("önceki en iyiyi geçen set rekor olur", () => {
  const records = detectNewPersonalRecords([s("bench", 60, 8)], [s("bench", 55, 8)]);
  assert.equal(records.length, 1);
  assert.equal(records[0].weightKg, 60);
  assert.ok(records[0].previousOneRepMaxKg > 0);
  assert.equal(records[0].isFirstRecord, false);
});

test("daha az ağırlıkla daha çok tekrar da rekor olabilir", () => {
  // 50 kg x 12 (1RM ~70) > 60 kg x 5 (1RM ~70)... net fark için 14 tekrar.
  const records = detectNewPersonalRecords([s("row", 50, 14)], [s("row", 60, 5)]);
  assert.equal(records.length, 1);
});

test("aynı veya düşük performans rekor sayılmaz", () => {
  assert.deepEqual(detectNewPersonalRecords([s("bench", 55, 8)], [s("bench", 55, 8)]), []);
  assert.deepEqual(detectNewPersonalRecords([s("bench", 50, 8)], [s("bench", 60, 8)]), []);
});

test("kıl payı fark rekor sayılmaz", () => {
  // 0.5 kg'lık eşiğin altı: yuvarlama gürültüsü kutlamayı anlamsızlaştırırdı.
  const records = detectNewPersonalRecords([s("bench", 55.2, 8)], [s("bench", 55, 8)]);
  assert.equal(records.length, 0);
});

test("ağırlıksız (vücut ağırlığı) setler rekor üretmez", () => {
  assert.deepEqual(detectNewPersonalRecords([s("plank", null, null)], []), []);
});

const library = [
  { name: "Leg Press", area: "Bacak", bodyweight: false, requires: ["leg press", "makine", "salon"] },
  { name: "Goblet Squat", area: "Bacak", bodyweight: false, requires: ["dambıl"] },
  { name: "Reverse Lunge", area: "Bacak", bodyweight: true, requires: [] },
  { name: "Şınav", area: "Göğüs", bodyweight: true, requires: [] },
];

test("alternatifler aynı bölgeden gelir, hareketin kendisi listelenmez", () => {
  const options = alternativeExercises(library[0], library);
  assert.ok(options.every((item) => item.area === "Bacak"));
  assert.ok(!options.some((item) => item.name === "Leg Press"));
  assert.ok(!options.some((item) => item.area === "Göğüs"));
});

test("makine dolu senaryosu: en az ekipman isteyen önce gelir", () => {
  const options = alternativeExercises(library[0], library);
  assert.equal(options[0].name, "Reverse Lunge", "vücut ağırlığı seçeneği başta olmalı");
  assert.equal(options[1].name, "Goblet Squat");
});

test("liste her çağrıda aynı sırada ve sınırlı döner", () => {
  const first = alternativeExercises(library[0], library, 1);
  const second = alternativeExercises(library[0], library, 1);
  assert.equal(first.length, 1);
  assert.deepEqual(first, second);
});
