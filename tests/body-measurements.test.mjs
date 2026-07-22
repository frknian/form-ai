import assert from "node:assert/strict";
import test from "node:test";
import { chartDomain, filterMeasurements, getMeasurementSummary, sortMeasurements } from "../lib/body-measurements.ts";

const measurements = [
  { id: "new", measuredAt: "2026-07-20", weightKg: 78, waistCm: 84, hipsCm: 99, chestCm: null, armCm: null, thighCm: null, note: null },
  { id: "old", measuredAt: "2026-06-20", weightKg: 80, waistCm: 87, hipsCm: 100, chestCm: null, armCm: null, thighCm: null, note: null },
  { id: "middle", measuredAt: "2026-07-10", weightKg: 79, waistCm: 85, hipsCm: null, chestCm: null, armCm: null, thighCm: null, note: null },
];

test("sorts measurements chronologically without mutating the source", () => {
  assert.deepEqual(sortMeasurements(measurements).map((item) => item.id), ["old", "middle", "new"]);
  assert.equal(measurements[0].id, "new");
});

test("filters body measurements by the requested time range", () => {
  const reference = new Date("2026-07-22T12:00:00Z").getTime();
  assert.deepEqual(filterMeasurements(measurements, "7d", reference).map((item) => item.id), ["new"]);
  assert.deepEqual(filterMeasurements(measurements, "30d", reference).map((item) => item.id), ["middle", "new"]);
  assert.equal(filterMeasurements(measurements, "all", reference).length, 3);
});

test("calculates latest value, absolute difference and percentage", () => {
  const summary = getMeasurementSummary(measurements, "weightKg");
  assert.ok(summary);
  assert.equal(summary.latest, 78);
  assert.equal(summary.difference, -2);
  assert.ok(Math.abs((summary.percentage ?? 0) - (-2.5)) < 0.001);
});

test("ignores missing values and returns a padded chart domain", () => {
  assert.equal(getMeasurementSummary(measurements, "chestCm"), null);
  const domain = chartDomain([84, 84]);
  assert.ok(domain.min < 84);
  assert.ok(domain.max > 84);
});
