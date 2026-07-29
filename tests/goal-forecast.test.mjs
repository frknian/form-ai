import assert from "node:assert/strict";
import test from "node:test";
import { forecastGoal, measuredWeeklyRate, projectEnergyBalance } from "../lib/goal-forecast.ts";

const TODAY = new Date("2026-07-27T00:00:00.000Z");

function daysAgo(days, weightKg) {
  return { dateIso: new Date(TODAY.getTime() - days * 86_400_000).toISOString(), weightKg };
}

/** windowDays gün boyunca her gün aynı kalori kaydı. */
function dailyEntries(days, calories, startDaysAgo = 0) {
  return Array.from({ length: days }, (_, index) => ({
    dateIso: new Date(TODAY.getTime() - (index + startDaysAgo) * 86_400_000).toISOString(),
    calories,
  }));
}

test("eksik kilo veya hedef uydurma tarih üretmez", () => {
  assert.equal(forecastGoal({ currentWeightKg: null, targetWeightKg: 90, today: TODAY }).status, "needs-weight");
  assert.equal(forecastGoal({ currentWeightKg: 100, targetWeightKg: null, today: TODAY }).status, "needs-target");
});

test("hedefe ulaşıldıysa tartı payıyla 'reached' döner", () => {
  assert.equal(forecastGoal({ currentWeightKg: 90.2, targetWeightKg: 90, today: TODAY }).status, "reached");
});

// Kullanıcının verdiği senaryo: 100 kilo, hedef 90.
test("100 kg → 90 kg: beslenme hedefi ve TDEE üzerinden süre hesaplanır", () => {
  // TDEE 2600, hedef alım 2100 → günde 500 kcal açık → haftada ~0,4545 kg.
  // 10 kg / 0,4545 ≈ 22 hafta.
  const forecast = forecastGoal({
    currentWeightKg: 100,
    targetWeightKg: 90,
    bmr: 1_900,
    tdee: 2_600,
    calorieTarget: 2_100,
    today: TODAY,
  });
  assert.equal(forecast.status, "ready");
  assert.equal(forecast.source, "energy");
  assert.equal(forecast.energy.expenditureBasis, "tdee");
  assert.equal(forecast.energy.intakeBasis, "target");
  assert.equal(Math.round(forecast.energy.balanceKcal), -500);
  assert.equal(forecast.weeks, 22);
  assert.equal(forecast.losing, true);
});

test("kaydedilen antrenman ve aktivite harcamayı artırıp süreyi kısaltır", () => {
  const base = { currentWeightKg: 100, targetWeightKg: 90, bmr: 1_900, tdee: 2_600, calorieTarget: 2_100, today: TODAY };
  const withoutActivity = forecastGoal(base);
  // 28 günün 20'sinde 600 kcal antrenman → dinlenme 2280 + 428 ≈ 2708 kcal harcama.
  const withActivity = forecastGoal({ ...base, activityEntries: dailyEntries(20, 600) });
  assert.equal(withActivity.energy.expenditureBasis, "logged");
  assert.ok(withActivity.energy.activityKcal > 400, `aktivite ortalaması: ${withActivity.energy.activityKcal}`);
  assert.ok(withActivity.weeks < withoutActivity.weeks, `hareketli: ${withActivity.weeks}, hareketsiz: ${withoutActivity.weeks}`);
});

test("az sayıda aktivite kaydı harcama tabanını değiştirmez", () => {
  // 3 gün < 5 günlük eşik: TDEE'ye güvenilir, yoksa tek bir antrenman
  // tüm ayın harcamasını temsil ediyormuş gibi davranılırdı.
  const forecast = forecastGoal({
    currentWeightKg: 100, targetWeightKg: 90, bmr: 1_900, tdee: 2_600, calorieTarget: 2_100,
    activityEntries: dailyEntries(3, 900), today: TODAY,
  });
  assert.equal(forecast.energy.expenditureBasis, "tdee");
});

test("kaydedilen öğünler hedefin yerine geçer", () => {
  // 10 gün boyunca 2500 kcal yenmiş; hedef 2100 dese de gerçek alım budur.
  const forecast = forecastGoal({
    currentWeightKg: 100, targetWeightKg: 90, bmr: 1_900, tdee: 2_600, calorieTarget: 2_100,
    intakeEntries: dailyEntries(10, 2_500), today: TODAY,
  });
  assert.equal(forecast.energy.intakeBasis, "logged");
  assert.equal(Math.round(forecast.energy.intakeKcal), 2_500);
  assert.equal(Math.round(forecast.energy.balanceKcal), -100);
});

test("kayıt girilmeyen gün 'sıfır kalori yedi' sayılmaz", () => {
  // 28 günün yalnız 6'sında kayıt var. Pencereye bölünseydi alım ~536 kcal
  // görünüp devasa sahte bir açık üretirdi.
  const projection = projectEnergyBalance({
    currentWeightKg: 100, targetWeightKg: 90, bmr: 1_900, tdee: 2_600, calorieTarget: 2_100,
    intakeEntries: dailyEntries(6, 2_500), today: TODAY,
  });
  assert.equal(Math.round(projection.intakeKcal), 2_500);
});

test("kilo alma yönü de desteklenir", () => {
  // Günde +550 kcal fazla → haftada +0,5 kg. 5 kg → 10 hafta.
  const forecast = forecastGoal({
    currentWeightKg: 60, targetWeightKg: 65, bmr: 1_500, tdee: 2_000, calorieTarget: 2_550, today: TODAY,
  });
  assert.equal(forecast.status, "ready");
  assert.equal(forecast.losing, false);
  assert.equal(forecast.weeks, 10);
});

test("fazla yerken kilo vermeyi beklemek negatif süre üretmez", () => {
  const forecast = forecastGoal({
    currentWeightKg: 100, targetWeightKg: 90, bmr: 1_900, tdee: 2_600, calorieTarget: 3_200, today: TODAY,
  });
  assert.equal(forecast.status, "wrong-direction");
  assert.ok(forecast.weeklyRateKg > 0);
});

test("denge sıfıra yakınsa tarih verilmez", () => {
  const forecast = forecastGoal({
    currentWeightKg: 100, targetWeightKg: 90, bmr: 1_900, tdee: 2_600, calorieTarget: 2_590, today: TODAY,
  });
  assert.equal(forecast.status, "no-rate");
});

test("beslenme hedefi yoksa ölçülen kilo trendine düşülür", () => {
  const forecast = forecastGoal({
    currentWeightKg: 96,
    targetWeightKg: 90,
    measurements: [daysAgo(28, 100), daysAgo(21, 99), daysAgo(14, 98), daysAgo(7, 97), daysAgo(0, 96)],
    today: TODAY,
  });
  assert.equal(forecast.status, "ready");
  assert.equal(forecast.source, "measured");
  assert.equal(forecast.weeks, 6);
});

test("ölçüm, enerji tahmininin yanında kontrol noktası olarak taşınır", () => {
  const forecast = forecastGoal({
    currentWeightKg: 100, targetWeightKg: 90, bmr: 1_900, tdee: 2_600, calorieTarget: 2_100,
    measurements: [daysAgo(28, 100.5), daysAgo(14, 100.2), daysAgo(0, 100)],
    today: TODAY,
  });
  assert.equal(forecast.source, "energy");
  assert.ok(forecast.measuredWeeklyRateKg !== null);
  // Gerçek kayıp plandan yavaş: kullanıcı bunu görebilmeli.
  assert.ok(Math.abs(forecast.measuredWeeklyRateKg) < Math.abs(forecast.weeklyRateKg));
});

test("ölçüm hızı kısa aralıkta hesaplanmaz", () => {
  assert.equal(measuredWeeklyRate([daysAgo(7, 91), daysAgo(0, 90)], TODAY), null);
  assert.equal(measuredWeeklyRate([daysAgo(10, 90)], TODAY), null);
});

test("sürdürülemez hız işaretlenir, çok uzak tahmin ufukla sınırlanır", () => {
  // Günde 1200 kcal açık → haftada ~1,09 kg; 100 kg için %1'in üzerinde.
  const fast = forecastGoal({ currentWeightKg: 100, targetWeightKg: 90, bmr: 1_900, tdee: 3_300, calorieTarget: 2_100, today: TODAY });
  assert.equal(fast.aggressive, true);

  const slow = forecastGoal({ currentWeightKg: 110, targetWeightKg: 80, bmr: 1_900, tdee: 2_600, calorieTarget: 2_530, today: TODAY });
  assert.equal(slow.beyondHorizon, true);
  assert.ok(slow.weeks > 104);
});

test("hiç enerji verisi yoksa tahmin üretilmez", () => {
  assert.equal(projectEnergyBalance({ currentWeightKg: 100, targetWeightKg: 90, today: TODAY }), null);
  assert.equal(forecastGoal({ currentWeightKg: 100, targetWeightKg: 90, today: TODAY }).status, "no-rate");
});
