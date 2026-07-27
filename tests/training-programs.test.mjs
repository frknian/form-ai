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

test("hazır program havuzu geniştir ve modern hedef seçici kararlı tema değişkenleri kullanır", async () => {
  const source = await readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const programIds = [...source.matchAll(/\{\s*id:\s*"[^"]+"\s+as const,\s*goal:/g)];
  assert.ok(programIds.length >= 15);
  assert.match(source, /role="group"/);
  assert.match(source, /aria-pressed=\{active\}/);
  assert.match(source, /program-filter-copy/);
  const filterStyles = styles.match(/\.program-goal-filters[\s\S]+?\.program-results/)?.[0] || "";
  assert.doesNotMatch(filterStyles, /var\(--page\)/);
  assert.match(filterStyles, /var\(--surface-elevated\)/);
});

test("Türkçe hazır program arayüzünde ekipman adı Dumbell olarak gösterilir", async () => {
  const source = await readFile(new URL("../components/FitAiApp.tsx", import.meta.url), "utf8");
  const dictionary = await readFile(new URL("../lib/i18n/dictionaries/tr.ts", import.meta.url), "utf8");
  assert.match(source, /replace\(\/Dambıl\/g, "Dumbell"\)/);
  assert.match(dictionary, /Dumbell ile/);
  assert.doesNotMatch(dictionary, /Dambılla/);
});

test("korumalı API istekleri 401 sonrası oturumu bir kez yeniler", async () => {
  const client = await readFile(new URL("../lib/api-client.ts", import.meta.url), "utf8");
  const coach = await readFile(new URL("../components/AiCoachChat.tsx", import.meta.url), "utf8");
  assert.match(client, /response\.status !== 401/);
  assert.match(client, /supabase\.auth\.refreshSession\(\)/);
  assert.match(coach, /\[401, 403, 503\]\.includes\(response\.status\)/);
  assert.match(coach, /localCoachReply\(value, locale\)/);
});
