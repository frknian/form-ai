import assert from "node:assert/strict";
import test from "node:test";
import { estimateOneRepMax, summarizePersonalRecords } from "../lib/personal-records.ts";

test("Epley 1RM tahmini bilinen değerleri verir", () => {
  assert.equal(estimateOneRepMax(100, 1), 100);
  assert.ok(Math.abs(estimateOneRepMax(100, 10) - 133.33) < 0.01);
  assert.equal(estimateOneRepMax(0, 5), 0);
  assert.equal(estimateOneRepMax(80, 0), 0);
});

test("kişisel rekorlar hareket bazında en yüksek tahmini 1RM'e göre çıkarılır", () => {
  const rows = [
    { exerciseKey: "squat", exerciseName: "Squat", completedAt: "2026-07-01T10:00:00Z", weightKg: 80, reps: 5 },
    { exerciseKey: "squat", exerciseName: "Squat", completedAt: "2026-07-10T10:00:00Z", weightKg: 90, reps: 5 },
    { exerciseKey: "bench", exerciseName: "Bench", completedAt: "2026-07-05T10:00:00Z", weightKg: 60, reps: 8 },
  ];
  const records = summarizePersonalRecords(rows);
  assert.equal(records.length, 2);
  // Squat daha yüksek 1RM olduğu için önce gelir
  assert.equal(records[0].exerciseKey, "squat");
  assert.equal(records[0].bestWeightKg, 90);
  assert.equal(records[0].bestReps, 5);
  assert.equal(records[0].sessionCount, 2);
  assert.equal(records[0].lastAchievedAt, "2026-07-10T10:00:00Z");
});

test("ağırlıksız veya tekrarsız setler rekor hesabına katılmaz", () => {
  const rows = [
    { exerciseKey: "plank", exerciseName: "Plank", completedAt: "2026-07-01T10:00:00Z", weightKg: null, reps: null },
    { exerciseKey: "curl", exerciseName: "Curl", completedAt: "2026-07-01T10:00:00Z", weightKg: 0, reps: 10 },
  ];
  assert.equal(summarizePersonalRecords(rows).length, 0);
});
