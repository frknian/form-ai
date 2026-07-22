import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { coreActivityCatalog, estimateActivityCalories, sportCatalog, sportByKey, validActivityDuration } from "../lib/sports.ts";

test("spor kılavuzu en yaygın 15 benzersiz sporu içerir", () => {
  assert.equal(sportCatalog.length, 15);
  assert.equal(new Set(sportCatalog.map((sport) => sport.key)).size, 15);
  assert.ok(sportCatalog.every((sport) => sport.name && sport.guide && sport.icon));
  assert.equal(sportByKey("swimming")?.name, "Yüzme");
  assert.equal(sportByKey("boxing")?.metrics[0]?.key, "rounds");
  assert.equal(sportByKey("cycling")?.metrics.some((metric) => metric.key === "elevationM"), true);
});

test("aktivite süresi güvenli günlük sınırlar içinde doğrulanır", () => {
  assert.equal(validActivityDuration("30"), true);
  assert.equal(validActivityDuration("0"), false);
  assert.equal(validActivityDuration("1441"), false);
  assert.equal(validActivityDuration("abc"), false);
});

test("ana aktivite kayıtları yalnız mevcut dört kapsamı sunar", () => {
  assert.deepEqual(coreActivityCatalog.map((activity) => activity.key), ["walking", "running", "cycling", "swimming"]);
});

test("aktivite kalorisi kilo, süre ve yoğunluğa göre otomatik hesaplanır", () => {
  assert.equal(estimateActivityCalories("walking", 30, 70, "Orta"), 158);
  assert.ok(estimateActivityCalories("running", 30, 70, "Yüksek") > estimateActivityCalories("running", 30, 70, "Hafif"));
  assert.ok(estimateActivityCalories("cycling", 45, 90, "Orta") > estimateActivityCalories("cycling", 45, 60, "Orta"));
  assert.equal(estimateActivityCalories("walking", 0, 70, "Orta"), 0);
});

test("aktivite günlükleri geçmişe ve seri özetine güvenli biçimde bağlanır", async () => {
  const [component, service, streak, migration] = await Promise.all([
    readFile(new URL("../components/ActivityLogger.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/activity-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/ActivityStreak.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/migrations/20260722_sport_activity_entries.sql", import.meta.url), "utf8"),
  ]);
  assert.match(component, /createActivityRepository/);
  assert.match(component, /record_streak_activity/);
  assert.match(component, /TAHMİNİ KALORİ/);
  assert.match(component, /estimateActivityCalories/);
  assert.match(component, /Aktivite geçmişin/);
  assert.match(component, /SPOR SEÇİM KILAVUZU/);
  assert.doesNotMatch(component, /GPS|Strava|akıllı saat|harita|yakında/i);
  assert.match(service, /interface ActivityRepository/);
  assert.match(service, /externalActivityId/);
  assert.match(service, /routeReference/);
  assert.doesNotMatch(streak, /Yürüyüş ekle|Diğer spor ekle/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /auth\.uid\(\) = user_id/);
  assert.match(migration, /estimated_calories/);
  assert.match(migration, /external_activity_id/);
});
