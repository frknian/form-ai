import assert from "node:assert/strict";
import test from "node:test";

import {
  dailyWorkoutScore,
  localPlanDayIndex,
  preferredWorkoutAreas,
  selectBalancedWorkoutItems,
} from "../lib/workout-planning.ts";

test("günlük plan kullanıcının yerel takvim gününde değişir", () => {
  const beforeMidnight = new Date(2026, 6, 28, 23, 59, 59);
  const afterMidnight = new Date(2026, 6, 29, 0, 0, 1);
  assert.equal(localPlanDayIndex(afterMidnight) - localPlanDayIndex(beforeMidnight), 1);
  assert.equal(localPlanDayIndex(beforeMidnight), localPlanDayIndex(new Date(2026, 6, 28, 8, 30)));
});

test("günlük sıralama profil için kararlı, farklı günlerde değişkendir", () => {
  const names = ["Squat", "Row", "Push-up", "Plank", "Bridge", "Press"];
  const order = (day) => names.slice().sort((a, b) => dailyWorkoutScore(a, 42, day) - dailyWorkoutScore(b, 42, day));
  assert.deepEqual(order(20_000), order(20_000));
  assert.notDeepEqual(order(20_000), order(20_001));
});

test("kişisel seçim istenen hareketi koruyup hedefe uygun dengeli kombinasyon kurar", () => {
  const candidates = [
    { name: "Özel Row", area: "Sırt", pinned: true, rank: 20 },
    { name: "Göğüs Press", area: "Göğüs", pinned: false, rank: 1 },
    { name: "Squat", area: "Bacak", pinned: false, rank: 2 },
    { name: "Plank", area: "Core", pinned: false, rank: 3 },
    { name: "İkinci Press", area: "Göğüs", pinned: false, rank: 0 },
  ];
  const selected = selectBalancedWorkoutItems({
    candidates,
    count: 4,
    preferredAreas: preferredWorkoutAreas("güç"),
    isPinned: (item) => item.pinned,
    rank: (item) => item.rank,
  });
  assert.equal(selected[0].name, "Özel Row");
  assert.deepEqual(new Set(selected.map((item) => item.area)), new Set(["Sırt", "Bacak", "Göğüs", "Core"]));
});

test("kilo verme ve kondisyon planı kondisyon hareketine öncelik verir", () => {
  const candidates = [
    { name: "Curl", area: "Kol" },
    { name: "Yürüyüş", area: "Kondisyon" },
    { name: "Squat", area: "Bacak" },
    { name: "Plank", area: "Core" },
  ];
  const selected = selectBalancedWorkoutItems({
    candidates,
    count: 3,
    preferredAreas: preferredWorkoutAreas("kilo"),
  });
  assert.deepEqual(selected.map((item) => item.area), ["Kondisyon", "Bacak", "Core"]);
});
