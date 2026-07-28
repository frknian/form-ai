import assert from "node:assert/strict";
import test from "node:test";
import { dailyWaterGoalMl, fastingState, formatDuration, waterProgressPercent } from "../lib/hydration-fasting.ts";

test("su hedefi kiloya göre hesaplanır ve makul aralıkta kalır", () => {
  assert.equal(dailyWaterGoalMl(70), 2_500);
  assert.equal(dailyWaterGoalMl(100), 3_500);
  // Çok düşük/yüksek kiloda güvenli sınırlara oturur.
  assert.equal(dailyWaterGoalMl(35), 1_500);
  assert.equal(dailyWaterGoalMl(150), 4_000);
  // Kilo bilinmiyorsa makul bir varsayılan.
  assert.equal(dailyWaterGoalMl(null), 2_000);
  assert.equal(dailyWaterGoalMl(0), 2_000);
});

test("su ilerlemesi %100'de sabitlenir", () => {
  assert.equal(waterProgressPercent(1_250, 2_500), 50);
  assert.equal(waterProgressPercent(5_000, 2_500), 100);
  assert.equal(waterProgressPercent(0, 2_500), 0);
  assert.equal(waterProgressPercent(-100, 2_500), 0);
});

const start = "2026-07-28T20:00:00.000Z";

test("oruç durumu geçen ve kalan süreyi verir", () => {
  const state = fastingState({ startedAt: start, targetHours: 16 }, new Date("2026-07-29T06:00:00.000Z"));
  assert.equal(state.elapsedMinutes, 600);
  assert.equal(state.remainingMinutes, 360);
  assert.equal(state.percent, 63);
  assert.equal(state.complete, false);
});

test("hedef aşıldığında yüzde 100'ü geçmez ama süre olduğu gibi raporlanır", () => {
  const state = fastingState({ startedAt: start, targetHours: 16 }, new Date("2026-07-29T16:00:00.000Z"));
  assert.equal(state.complete, true);
  assert.equal(state.percent, 100);
  assert.equal(state.remainingMinutes, 0);
  assert.equal(state.elapsedMinutes, 1_200, "geçen süre kırpılmamalı");
});

test("geçersiz pencere null döner", () => {
  assert.equal(fastingState({ startedAt: "bozuk", targetHours: 16 }), null);
  assert.equal(fastingState({ startedAt: start, targetHours: 0 }), null);
});

test("süre biçimi saat ve dakikayı ayırır", () => {
  assert.equal(formatDuration(600), "10s 0dk");
  assert.equal(formatDuration(45), "45dk");
  assert.equal(formatDuration(0), "0dk");
  assert.equal(formatDuration(90, "en"), "1h 30m");
});
