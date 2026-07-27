import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  equipmentMatchesInventory,
  exerciseDifficultyScore,
  normalizeEquipmentInventory,
  orderExercisesForProgression,
} from "../lib/training-programs.ts";

test("dambıl ekipmanı Türkçe ve yaygın İngilizce yazımlarla eşleşir", () => {
  assert.match(normalizeEquipmentInventory("Ayarlanabilir dumbell"), /dumbbell/);
  assert.equal(equipmentMatchesInventory("2 adet dambıl", ["dumbbell"]), true);
  assert.equal(equipmentMatchesInventory("dumbell ve direnç lastiği", ["dambıl"]), true);
  assert.equal(equipmentMatchesInventory("yalnızca mat", ["dumbbell"]), false);
});

test("ilk antrenmanlarda ileri hareketler elenir ve hareketler kolaydan zora sıralanır", () => {
  const exercises = ["Burpee", "Goblet Squat", "Glute Bridge", "Dead Bug"];
  assert.equal(exerciseDifficultyScore("Glute Bridge"), 0);
  assert.equal(exerciseDifficultyScore("Burpee"), 2);
  assert.deepEqual(orderExercisesForProgression(exercises, 0, String), ["Glute Bridge", "Dead Bug", "Goblet Squat"]);
  assert.deepEqual(orderExercisesForProgression(exercises, 7, String), ["Glute Bridge", "Dead Bug", "Goblet Squat", "Burpee"]);
});

test("salon full body şablonu yalnızca salon ekipmanlı hareketlerden oluşur", async () => {
  const source = await readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8");
  const gymProgram = source.match(/\{\s*id:\s*"strengthGym"[^}]+\}/)?.[0] || "";
  assert.match(gymProgram, /mode:\s*"gym"/);
  for (const exercise of ["Leg Press", "Oturarak Leg Curl", "Lat Pulldown", "Oturarak Kablo Row", "Pec Deck", "Makine Omuz Press"]) {
    assert.match(gymProgram, new RegExp(exercise));
  }
  assert.doesNotMatch(gymProgram, /Reverse Lunge|Plank/);
});
