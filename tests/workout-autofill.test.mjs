import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { applyPreviousPerformance, createWorkoutSetDrafts } from "../lib/workout-log.ts";

function previous(sets) {
  return { exerciseLogId: "x", exerciseName: "Goblet Squat", completedAt: "2026-07-20T10:00:00.000Z", isBodyweight: false, sets };
}
const set = (setNumber, weightKg, reps) => ({ setNumber, weightKg, reps, durationSeconds: null, rpe: null, note: null });

test("geçen seferin ağırlık ve tekrarı boş alanlara yazılır", () => {
  const drafts = createWorkoutSetDrafts(3, "10 tekrar");
  const filled = applyPreviousPerformance(drafts, previous([set(1, 40, 10), set(2, 42.5, 8), set(3, 42.5, 8)]));
  assert.equal(filled[0].weightKg, "40");
  assert.equal(filled[1].weightKg, "42.5");
  assert.equal(filled[2].weightKg, "42.5");
});

test("kullanıcının girdiği değer asla ezilmez", () => {
  const drafts = createWorkoutSetDrafts(2, "10 tekrar").map((draft, index) => index === 0 ? { ...draft, weightKg: "50" } : draft);
  const filled = applyPreviousPerformance(drafts, previous([set(1, 40, 10), set(2, 40, 10)]));
  assert.equal(filled[0].weightKg, "50", "elle girilen ağırlık korunmalı");
  assert.equal(filled[1].weightKg, "40");
});

test("tamamlanmış set hiç değiştirilmez", () => {
  const drafts = createWorkoutSetDrafts(2, "10 tekrar").map((draft, index) => index === 0 ? { ...draft, completed: true } : draft);
  const filled = applyPreviousPerformance(drafts, previous([set(1, 40, 10), set(2, 40, 10)]));
  assert.equal(filled[0].weightKg, "", "tamamlanmış sete dokunulmamalı");
  assert.equal(filled[1].weightKg, "40");
});

test("bu hafta fazladan set varsa son bilinen set referans alınır", () => {
  const drafts = createWorkoutSetDrafts(4, "10 tekrar");
  const filled = applyPreviousPerformance(drafts, previous([set(1, 40, 10), set(2, 40, 10)]));
  assert.equal(filled[3].weightKg, "40");
});

test("geçmiş yoksa taslaklar olduğu gibi kalır", () => {
  const drafts = createWorkoutSetDrafts(3, "10 tekrar");
  assert.deepEqual(applyPreviousPerformance(drafts, null), drafts);
  assert.deepEqual(applyPreviousPerformance(drafts, previous([])), drafts);
});

test("kalori takibi yemek adı ve gramajı yapay zekâya gönderir", async () => {
  const source = await readFile(new URL("../components/CalorieTracker.tsx", import.meta.url), "utf8");
  assert.match(source, /\/api\/nutrition\/parse-text/);
  assert.match(source, /JSON\.stringify\(\{ query, grams: portionGrams/);
  assert.match(source, /await estimateFromText\(true\)/);
  assert.match(source, /record\.isEstimated \|\| aiEstimate/);
  assert.doesNotMatch(source, /\/api\/nutrition\/barcode/);
  assert.doesNotMatch(source, /BrowserMultiFormatReader/);
});
