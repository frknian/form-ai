import assert from "node:assert/strict";
import test from "node:test";
import { buildCompletedExerciseLog, createWorkoutSetDrafts, exerciseLogKey, progressionSuggestion } from "../lib/workout-log.ts";
import { tr } from "../lib/i18n/dictionaries/tr.ts";

test("creates repetition and timed set drafts from the prescription", () => {
  const repetitions = createWorkoutSetDrafts(3, "10 tekrar");
  const timed = createWorkoutSetDrafts(2, "30 sn");
  assert.equal(repetitions.length, 3);
  assert.equal(repetitions[0].reps, "10");
  assert.equal(repetitions[0].durationSeconds, "");
  assert.equal(timed[0].reps, "");
  assert.equal(timed[0].durationSeconds, "30");
});

test("persists only completed sets and normalizes numeric values", () => {
  const drafts = createWorkoutSetDrafts(2, "8 tekrar");
  drafts[0] = { ...drafts[0], completed: true, weightKg: "20,5", rpe: "7", note: "Kontrollü" };
  const log = buildCompletedExerciseLog({ exerciseId: "db-press", exerciseName: "Yerde Dambıl Göğüs Presi", exerciseOrder: 1, isBodyweight: false, drafts });
  assert.equal(log?.sets.length, 1);
  assert.deepEqual(log?.sets[0], { setNumber: 1, weightKg: 20.5, reps: 8, durationSeconds: null, rpe: 7, note: "Kontrollü" });
  assert.equal(log?.exerciseKey, "yerde-dambil-gogus-presi");
  assert.equal(exerciseLogKey("Şınav"), "sinav");
});

test("suggests a small weight increase after an easy weighted performance", () => {
  const suggestion = progressionSuggestion({ exerciseLogId: "one", exerciseName: "Goblet Squat", completedAt: "2026-07-20T10:00:00Z", isBodyweight: false, sets: [
    { setNumber: 1, weightKg: 20, reps: 10, durationSeconds: null, rpe: 7, note: null },
    { setNumber: 2, weightKg: 20, reps: 10, durationSeconds: null, rpe: 6, note: null },
  ] }, tr);
  assert.match(suggestion, /22,5 kg/);
  assert.match(suggestion, /ağrı/i);
});

test("uses repetitions or duration for bodyweight progression", () => {
  const repetitionSuggestion = progressionSuggestion({ exerciseLogId: "two", exerciseName: "Şınav", completedAt: "2026-07-20T10:00:00Z", isBodyweight: true, sets: [{ setNumber: 1, weightKg: null, reps: 12, durationSeconds: null, rpe: 6, note: null }] }, tr);
  const durationSuggestion = progressionSuggestion({ exerciseLogId: "three", exerciseName: "Plank", completedAt: "2026-07-20T10:00:00Z", isBodyweight: true, sets: [{ setNumber: 1, weightKg: null, reps: null, durationSeconds: 30, rpe: 7, note: null }] }, tr);
  assert.match(repetitionSuggestion, /13–14 tekrar/);
  assert.match(durationSuggestion, /35 saniye/);
});

test("does not increase load after a very hard performance", () => {
  const suggestion = progressionSuggestion({ exerciseLogId: "four", exerciseName: "Leg Press", completedAt: "2026-07-20T10:00:00Z", isBodyweight: false, sets: [{ setNumber: 1, weightKg: 80, reps: 8, durationSeconds: null, rpe: 9, note: null }] }, tr);
  assert.match(suggestion, /Yükü artırma/);
  assert.doesNotMatch(suggestion, /82,5 kg/);
});
