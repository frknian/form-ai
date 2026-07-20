import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { filterExercises, getAllExercises, getExerciseById, getExercisesByEquipment, getExercisesByLevel, getExercisesByMuscle, getExercisesForAI, searchExercises } from "../lib/exercise-service.ts";
import { nextFrameIndex, shouldCycleFrames } from "../lib/exercise-animation.ts";

test("egzersiz veri seti normalize edilerek yüklenir", () => {
  const exercises = getAllExercises();
  assert.ok(exercises.length >= 100);
  assert.ok(exercises.every((exercise) => exercise.id && exercise.name && exercise.primaryMuscles.length && exercise.images.length >= 1));
});

test("egzersiz adı büyük-küçük harf duyarsız aranır", () => {
  const matches = searchExercises("PRESS");
  assert.ok(matches.length > 0);
  assert.ok(matches.every((exercise) => `${exercise.name} ${exercise.primaryMuscles.join(" ")} ${exercise.secondaryMuscles.join(" ")} ${exercise.equipment}`.toLowerCase().includes("press")));
});

test("kas ve ekipman adları Türkçe aranabilir", () => {
  assert.ok(searchExercises("göğüs").length > 0);
  assert.ok(searchExercises("dambıl").length > 0);
});

test("kas grubu, ekipman ve seviye filtreleri ayrı ayrı çalışır", () => {
  assert.ok(getExercisesByMuscle("chest").every((exercise) => [...exercise.primaryMuscles, ...exercise.secondaryMuscles].includes("chest")));
  assert.ok(getExercisesByEquipment("dumbbell").every((exercise) => exercise.equipment === "dumbbell"));
  assert.ok(getExercisesByLevel("beginner").every((exercise) => exercise.level === "beginner"));
});

test("birleşik filtreler aynı anda uygulanır", () => {
  const matches = filterExercises({ muscle: "biceps", equipment: "dumbbell", level: "beginner" });
  assert.ok(matches.length > 0);
  assert.ok(matches.every((exercise) => [...exercise.primaryMuscles, ...exercise.secondaryMuscles].includes("biceps") && exercise.equipment === "dumbbell" && exercise.level === "beginner"));
});

test("geçersiz egzersiz kimliği güvenli biçimde reddedilir", () => {
  assert.equal(getExerciseById("../../etc/passwd"), null);
  assert.equal(getExerciseById("olmayan-egzersiz"), null);
});

test("AI bağlamı yalnızca gerekli alanları içerir", () => {
  const [context] = getExercisesForAI({ muscle: "chest" });
  assert.deepEqual(Object.keys(context).sort(), ["category", "equipment", "id", "level", "name", "primaryMuscles", "secondaryMuscles"].sort());
  assert.equal("images" in context, false);
  assert.equal("instructions" in context, false);
});

test("tek görselde timer kurulmaz, çok görselde kare değişir", () => {
  assert.equal(shouldCycleFrames(1, true, true, false), false);
  assert.equal(shouldCycleFrames(2, true, true, false), true);
  assert.equal(shouldCycleFrames(2, false, true, false), false);
  assert.equal(shouldCycleFrames(2, true, false, false), false);
  assert.equal(shouldCycleFrames(2, true, true, true), false);
  assert.equal(nextFrameIndex(0, 2), 1);
  assert.equal(nextFrameIndex(1, 2), 0);
});

test("animasyon görünürlük, fallback ve timer temizliğini uygular", async () => {
  const source = await readFile(new URL("../components/exercises/ExerciseAnimation.tsx", import.meta.url), "utf8");
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /clearInterval\(timer\)/);
  assert.match(source, /Egzersiz görseli bulunamadı/);
  assert.match(source, /loading="lazy"/);
});
