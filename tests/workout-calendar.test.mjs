import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { localDateKey } from "../lib/streak.ts";
import { zonedDateTime, localWeek, nextWorkoutOccurrence, scheduleDisplayStatus } from "../lib/workout-calendar.ts";

test("uses explicit date boundaries and local workout time for a given zone", () => {
  assert.equal(localDateKey(new Date("2026-01-01T21:30:00Z"), "Europe/Istanbul"), "2026-01-02");
  assert.equal(zonedDateTime("2026-07-22", "19:00", "Europe/Istanbul").toISOString(), "2026-07-22T16:00:00.000Z");
});

test("builds a Monday-to-Sunday week for a given zone", () => {
  assert.deepEqual(localWeek(new Date("2026-07-22T10:00:00Z"), 0, "Europe/Istanbul"), ["2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26"]);
});

test("saat dilimi konuma göre değişir, sabit değildir", () => {
  // Aynı UTC anı, farklı saat dilimlerinde farklı takvim gününe düşebilir —
  // bu, saat diliminin artık Europe/Istanbul'a sabit olmadığının kanıtıdır.
  const instant = new Date("2026-01-01T02:30:00Z");
  assert.equal(localDateKey(instant, "Pacific/Honolulu"), "2025-12-31");
  assert.equal(localDateKey(instant, "Europe/Istanbul"), "2026-01-01");
});

test("derives planned and missed states from date and time in a given zone", () => {
  const now = new Date("2026-07-22T17:00:00Z");
  const timeZone = "Europe/Istanbul";
  assert.equal(scheduleDisplayStatus({ date: "2026-07-22", time: "19:00", workoutDays: [3], now, timeZone }), "missed");
  assert.equal(scheduleDisplayStatus({ date: "2026-07-24", time: "19:00", workoutDays: [5], now, timeZone }), "planned");
  assert.equal(scheduleDisplayStatus({ date: "2026-07-23", time: "19:00", workoutDays: [3, 5], now, timeZone }), "unscheduled");
  assert.equal(scheduleDisplayStatus({ date: "2026-07-22", time: "19:00", explicitStatus: "completed", workoutDays: [3], now, timeZone }), "completed");
});

test("finds the next planned occurrence and skips rest days", () => {
  const preferences = { workoutDays: [3, 5], preferredTime: "19:00", reminderMinutesBefore: 30, browserNotifications: false, timezone: "Europe/Istanbul" };
  const entries = [{ id: "rest", scheduledDate: "2026-07-22", scheduledTime: "19:00", status: "rest", originalDate: null, completedSessionId: null }];
  const next = nextWorkoutOccurrence(preferences, entries, new Date("2026-07-22T14:00:00Z"));
  assert.equal(next?.date, "2026-07-24");
  assert.equal(next?.time, "19:00");
});

test("asks for notification permission only after an explicit user action and explains fallbacks", async () => {
  const [calendar, mobile] = await Promise.all([
    readFile(new URL("../components/WorkoutCalendar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/mobile.ts", import.meta.url), "utf8"),
  ]);
  assert.match(calendar, /t\.workoutCalendar\.enableBrowserNotifications/);
  assert.match(calendar, /t\.workoutCalendar\.goToBrowserSettings/);
  assert.match(calendar, /t\.workoutCalendar\.howToEnablePermission/);
  assert.match(calendar, /t\.workoutCalendar\.disableReminders/);
  assert.match(calendar, /requestNotificationPermission\(\)/);
  assert.match(mobile, /window\.isSecureContext/);
  assert.match(mobile, /Notification\.requestPermission\(\)\.catch/);
});
