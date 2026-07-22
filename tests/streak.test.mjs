import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { localClock, localDateKey, nextStreakValue, shouldFreezeStreak } from "../lib/streak.ts";

test("uses a supplied local timezone for day boundaries", () => {
  const instant = new Date("2026-07-22T21:30:00Z");
  assert.equal(localDateKey(instant, "Europe/Istanbul"), "2026-07-23");
  assert.deepEqual(localClock(instant, "Europe/Istanbul"), { hour: 0, minute: 30 });
});

test("does not increase a streak more than once on the same day", () => {
  assert.equal(nextStreakValue(5, true, []), 5);
});

test("keeps a streak alive only across explicitly planned rest days", () => {
  assert.equal(shouldFreezeStreak(["rest", "rest"]), true);
  assert.equal(nextStreakValue(5, false, ["rest"]), 6);
  assert.equal(nextStreakValue(5, false, ["rest", "planned"]), 1);
});

test("keeps streak updates inside the database layer", async () => {
  const migration = await readFile(new URL("../db/migrations/20260722_activity_streaks.sql", import.meta.url), "utf8");
  assert.match(migration, /create table if not exists public\.user_streaks/);
  assert.match(migration, /create table if not exists public\.activity_logs/);
  assert.match(migration, /record_streak_activity/);
  assert.match(migration, /workout_sessions_record_streak/);
  assert.match(migration, /not v_had_activity and not v_new/);
});
