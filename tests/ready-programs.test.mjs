import assert from "node:assert/strict";
import test from "node:test";
import { EQUIPMENT_PROFILES, buildReadyProgram, isReplacementCompatible, matchesProfile } from "../lib/ready-programs.ts";

const pushup = { name: "Şınav", area: "Göğüs", requires: [], bodyweight: true };
const plank = { name: "Plank", area: "Core", requires: [], bodyweight: true };
const bridge = { name: "Glute Bridge", area: "Kalça", requires: [], bodyweight: true };
const lunge = { name: "Reverse Lunge", area: "Bacak", requires: [], bodyweight: true };
const dumbbellRow = { name: "Dambıl Row", area: "Sırt", requires: ["dambıl"], bodyweight: false };
const goblet = { name: "Goblet Squat", area: "Bacak", requires: ["dambıl", "kettlebell"], bodyweight: false };
const dumbbellPress = { name: "Dambıl Omuz Press", area: "Omuz", requires: ["dambıl"], bodyweight: false };
const bandRow = { name: "Band Row", area: "Sırt", requires: ["band", "lastik"], bodyweight: false };
const legPress = { name: "Leg Press", area: "Bacak", requires: ["leg press", "makine", "salon"], bodyweight: false };
const latPulldown = { name: "Lat Pulldown", area: "Sırt", requires: ["lat pulldown", "makine", "salon"], bodyweight: false };

const library = [pushup, plank, bridge, lunge, dumbbellRow, goblet, dumbbellPress, bandRow, legPress, latPulldown];

test("ekipmansız profil yalnızca vücut ağırlığı kabul eder", () => {
  // Bildirilen hata buydu: ekipmansız programda dambıl hareketi çıkıyordu.
  assert.equal(matchesProfile(pushup, "equipmentFree"), true);
  assert.equal(matchesProfile(dumbbellRow, "equipmentFree"), false);
  assert.equal(matchesProfile(bandRow, "equipmentFree"), false);
  assert.equal(matchesProfile(legPress, "equipmentFree"), false);
});

test("her profil yalnız kendi ekipmanını ve vücut ağırlığını alır", () => {
  assert.equal(matchesProfile(dumbbellRow, "dumbbell"), true);
  assert.equal(matchesProfile(bandRow, "dumbbell"), false, "dambıl programına band girmemeli");
  assert.equal(matchesProfile(legPress, "dumbbell"), false, "dambıl programına salon makinesi girmemeli");

  assert.equal(matchesProfile(bandRow, "band"), true);
  assert.equal(matchesProfile(dumbbellRow, "band"), false);

  // Vücut ağırlığı her yerde yapılabilir, dışlamak programı gereksiz daraltırdı.
  assert.equal(matchesProfile(pushup, "dumbbell"), true);
  assert.equal(matchesProfile(pushup, "band"), true);
});

test("salon profili serbest ağırlık dahil her şeyi kapsar", () => {
  for (const exercise of [legPress, dumbbellRow, bandRow, pushup]) {
    assert.equal(matchesProfile(exercise, "gym"), true, exercise.name);
  }
});

test("ekipmansız program hiçbir ekipmanlı hareket içermez", () => {
  const program = buildReadyProgram(library, "equipmentFree");
  assert.ok(program.length > 0);
  for (const exercise of program) {
    assert.equal(exercise.bodyweight, true, `ekipmanlı hareket sızdı: ${exercise.name}`);
  }
});

test("ekipmanlı profil o ekipmanı gerçekten kullanır", () => {
  // "Dambıl ile güç" deyip beş vücut ağırlığı hareketi vermek anlamsız olurdu.
  const program = buildReadyProgram(library, "dumbbell");
  assert.ok(program.some((exercise) => exercise.requires.includes("dambıl")), "dambıl hareketi yok");
  assert.ok(!program.some((exercise) => exercise.requires.includes("leg press")), "salon makinesi sızdı");
});

test("program bölgelere dengeli dağılır", () => {
  const program = buildReadyProgram(library, "gym");
  const areas = new Set(program.map((exercise) => exercise.area));
  assert.ok(areas.size >= 4, `tek bölgeye yığılmış: ${[...areas].join(", ")}`);
});

test("program deterministiktir", () => {
  // Kullanıcı dün yaptığı hareketi bugün de aynı yerde bulmalı.
  for (const profile of EQUIPMENT_PROFILES) {
    assert.deepEqual(buildReadyProgram(library, profile), buildReadyProgram(library, profile), profile);
  }
});

test("istenen sayıdan fazla hareket verilmez", () => {
  assert.equal(buildReadyProgram(library, "gym", 3).length, 3);
  assert.ok(buildReadyProgram(library, "band").length <= 5);
});

test("ağrı yerine konan hareket plandaki ekipmanla uyumlu olmalı", () => {
  const bodyweightPlan = [pushup, plank, lunge];
  assert.equal(isReplacementCompatible(bridge, bodyweightPlan), true);
  assert.equal(isReplacementCompatible(dumbbellRow, bodyweightPlan), false, "ekipmansız plana dambıl konmamalı");

  const dumbbellPlan = [goblet, dumbbellRow];
  assert.equal(isReplacementCompatible(dumbbellPress, dumbbellPlan), true);
  assert.equal(isReplacementCompatible(legPress, dumbbellPlan), false, "eve salon makinesi konmamalı");
});
