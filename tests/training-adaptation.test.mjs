import assert from "node:assert/strict";
import test from "node:test";
import { adaptPrescription, summarizeTrainingAdaptation } from "../lib/training-adaptation.ts";

test("increases load only after repeated easy, low-fatigue sessions", () => {
  const result = summarizeTrainingAdaptation([
    { completedExercises: 5, totalExercises: 5, difficulty: "Kolay", fatigue: 2, painAreas: ["Yok"] },
    { completedExercises: 5, totalExercises: 5, difficulty: "Kolay", fatigue: 2, painAreas: ["Yok"] },
  ]);
  assert.equal(result.direction, "increase");
  assert.deepEqual(adaptPrescription(3, 10, 60, result), { sets: 4, reps: 12, restSeconds: 50 });
});

test("reduces load and preserves pain areas after difficult feedback", () => {
  const result = summarizeTrainingAdaptation([
    { completedExercises: 3, totalExercises: 5, difficulty: "Zor", fatigue: 5, painAreas: ["Diz"] },
    { completedExercises: 4, totalExercises: 5, difficulty: "Zor", fatigue: 4, painAreas: ["Diz", "Bel"] },
  ]);
  assert.equal(result.direction, "deload");
  assert.deepEqual(result.painAreas.sort(), ["Bel", "Diz"]);
  assert.deepEqual(adaptPrescription(3, 10, 60, result), { sets: 2, reps: 8, restSeconds: 80 });
});

test("keeps a balanced load when the evidence does not justify a change", () => {
  const result = summarizeTrainingAdaptation([
    { completedExercises: 4, totalExercises: 5, difficulty: "Uygun", fatigue: 3, painAreas: ["Yok"] },
  ]);
  assert.equal(result.direction, "maintain");
  assert.deepEqual(adaptPrescription(3, 10, 60, result), { sets: 3, reps: 10, restSeconds: 60 });
});
