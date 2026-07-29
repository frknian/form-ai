import assert from "node:assert/strict";
import test from "node:test";
import { summarizeActivities } from "../lib/activity-service.ts";

function entry(overrides) {
  return {
    id: crypto.randomUUID(),
    activityType: "sport",
    activityKey: "running",
    activityName: "Koşu",
    occurredAt: "2026-07-22T07:00:00.000Z",
    localDate: "2026-07-22",
    durationMinutes: 30,
    distanceKm: 5,
    estimatedCalories: 320,
    steps: 5500,
    intensity: "orta",
    notes: null,
    source: "manual",
    provider: null,
    externalActivityId: null,
    routeReference: null,
    metadata: {},
    schemaVersion: 1,
    ...overrides,
  };
}

test("günlük aktivite özeti aynı gündeki kayıtları birleştirir", () => {
  const summaries = summarizeActivities([
    entry({}),
    entry({ id: crypto.randomUUID(), activityKey: "walking", activityName: "Yürüyüş", durationMinutes: 20, distanceKm: 1.5, estimatedCalories: 90, steps: 2200 }),
  ]);

  assert.deepEqual(summaries, [{
    localDate: "2026-07-22",
    activityCount: 2,
    durationMinutes: 50,
    distanceKm: 6.5,
    estimatedCalories: 410,
    steps: 7700,
  }]);
});

test("günlük aktivite özetleri en yeni gün önce olacak şekilde sıralanır", () => {
  const summaries = summarizeActivities([
    entry({ localDate: "2026-07-20", distanceKm: null, estimatedCalories: null, steps: null }),
    entry({ id: crypto.randomUUID(), localDate: "2026-07-22" }),
    entry({ id: crypto.randomUUID(), localDate: "2026-07-21" }),
  ]);

  assert.deepEqual(summaries.map((summary) => summary.localDate), ["2026-07-22", "2026-07-21", "2026-07-20"]);
  assert.equal(summaries[2].distanceKm, 0);
  assert.equal(summaries[2].estimatedCalories, 0);
  assert.equal(summaries[2].steps, 0);
});
