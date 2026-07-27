import assert from "node:assert/strict";
import test from "node:test";
import { forecastGoal, measuredWeeklyRate, plannedWeeklyRate } from "../lib/goal-forecast.ts";

const TODAY = new Date("2026-07-27T00:00:00.000Z");

function daysAgo(days, weightKg) {
  return { dateIso: new Date(TODAY.getTime() - days * 86_400_000).toISOString(), weightKg };
}

test("eksik kilo veya hedef uydurma tarih üretmez", () => {
  assert.equal(forecastGoal({ currentWeightKg: null, targetWeightKg: 75, today: TODAY }).status, "needs-weight");
  assert.equal(forecastGoal({ currentWeightKg: 90, targetWeightKg: null, today: TODAY }).status, "needs-target");
  assert.equal(forecastGoal({ currentWeightKg: 90, targetWeightKg: 0, today: TODAY }).status, "needs-target");
});

test("hedefe ulaşıldıysa tartı payıyla birlikte 'reached' döner", () => {
  assert.equal(forecastGoal({ currentWeightKg: 75.2, targetWeightKg: 75, today: TODAY }).status, "reached");
  assert.equal(forecastGoal({ currentWeightKg: 75.9, targetWeightKg: 75, today: TODAY }).status, "no-rate");
});

test("tek ölçüm veya çok kısa aralık hız üretmez", () => {
  assert.equal(measuredWeeklyRate([daysAgo(10, 90)], TODAY), null);
  // 7 günlük aralık eşiğin (14) altında; günlük dalgalanma eğimi yanıltır.
  assert.equal(measuredWeeklyRate([daysAgo(7, 91), daysAgo(0, 90)], TODAY), null);
});

test("ölçülen haftalık hız en küçük karelerle hesaplanır", () => {
  // 28 günde 90 -> 86 kg, yani haftada -1 kg.
  const rate = measuredWeeklyRate([daysAgo(28, 90), daysAgo(21, 89), daysAgo(14, 88), daysAgo(7, 87), daysAgo(0, 86)], TODAY);
  assert.ok(rate !== null);
  assert.ok(Math.abs(rate + 1) < 0.001, `beklenen ≈ -1, gelen ${rate}`);
});

test("kalori açığından teorik hız türetilir", () => {
  // Günde -550 kcal ≈ haftada -0.5 kg (7700 kcal/kg).
  const rate = plannedWeeklyRate(-550);
  assert.ok(Math.abs(rate + 0.5) < 0.01, `gelen ${rate}`);
  assert.equal(plannedWeeklyRate(0), null);
  assert.equal(plannedWeeklyRate(null), null);
});

test("ölçüm varsa plan yerine ölçülen hız kullanılır", () => {
  const forecast = forecastGoal({
    currentWeightKg: 86,
    targetWeightKg: 80,
    measurements: [daysAgo(28, 90), daysAgo(21, 89), daysAgo(14, 88), daysAgo(7, 87), daysAgo(0, 86)],
    calorieAdjustmentPerDay: -1100, // plan haftada -1 kg'dan hızlı derdi
    today: TODAY,
  });
  assert.equal(forecast.status, "ready");
  assert.equal(forecast.source, "measured");
  assert.equal(forecast.weeks, 6); // 6 kg / 1 kg-hafta
  assert.equal(forecast.losing, true);
});

test("ölçüm yoksa beslenme planından tahmin edilir", () => {
  const forecast = forecastGoal({ currentWeightKg: 90, targetWeightKg: 85, calorieAdjustmentPerDay: -550, today: TODAY });
  assert.equal(forecast.status, "ready");
  assert.equal(forecast.source, "plan");
  assert.equal(forecast.weeks, 10); // 5 kg / 0.5 kg-hafta
  assert.equal(forecast.etaIso, "2026-10-05");
});

test("hedefin ters yönüne gidiliyorsa negatif süre yerine uyarı döner", () => {
  const forecast = forecastGoal({
    currentWeightKg: 90,
    targetWeightKg: 80,
    measurements: [daysAgo(28, 88), daysAgo(14, 89), daysAgo(0, 90)],
    today: TODAY,
  });
  assert.equal(forecast.status, "wrong-direction");
  assert.ok(forecast.weeklyRateKg > 0);
});

test("hız yok denecek kadar küçükse tarih verilmez", () => {
  const forecast = forecastGoal({
    currentWeightKg: 90,
    targetWeightKg: 80,
    measurements: [daysAgo(28, 90), daysAgo(14, 90), daysAgo(0, 89.99)],
    today: TODAY,
  });
  assert.equal(forecast.status, "no-rate");
});

test("sürdürülemez hız işaretlenir ve çok uzak tahmin ufukla sınırlanır", () => {
  // Haftada -1.5 kg, 90 kg için %1'in (0.9 kg) üzerinde.
  const fast = forecastGoal({ currentWeightKg: 90, targetWeightKg: 80, calorieAdjustmentPerDay: -1650, today: TODAY });
  assert.equal(fast.status, "ready");
  assert.equal(fast.aggressive, true);

  // Haftada 0.06 kg ile 30 kg → 500 haftadan fazla.
  const slow = forecastGoal({ currentWeightKg: 110, targetWeightKg: 80, calorieAdjustmentPerDay: -66, today: TODAY });
  assert.equal(slow.status, "ready");
  assert.equal(slow.beyondHorizon, true);
  assert.ok(slow.weeks > 104);
});

test("kilo alma hedefi de desteklenir", () => {
  const forecast = forecastGoal({ currentWeightKg: 60, targetWeightKg: 65, calorieAdjustmentPerDay: 550, today: TODAY });
  assert.equal(forecast.status, "ready");
  assert.equal(forecast.losing, false);
  assert.equal(forecast.weeks, 10);
});
