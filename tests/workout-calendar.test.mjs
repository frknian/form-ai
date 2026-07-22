import assert from "node:assert/strict";
import test from "node:test";
import { istanbulDateKey, istanbulDateTime, istanbulWeek, nextWorkoutOccurrence, scheduleDisplayStatus } from "../lib/workout-calendar.ts";

test("uses Europe/Istanbul date boundaries and local workout time", () => {
  assert.equal(istanbulDateKey(new Date("2026-01-01T21:30:00Z")), "2026-01-02");
  assert.equal(istanbulDateTime("2026-07-22", "19:00").toISOString(), "2026-07-22T16:00:00.000Z");
});

test("builds a Monday-to-Sunday Istanbul week", () => {
  assert.deepEqual(istanbulWeek(new Date("2026-07-22T10:00:00Z")), ["2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26"]);
});

test("derives planned and missed states from Istanbul date and time", () => {
  const now = new Date("2026-07-22T17:00:00Z");
  assert.equal(scheduleDisplayStatus({ date: "2026-07-22", time: "19:00", workoutDays: [3], now }), "missed");
  assert.equal(scheduleDisplayStatus({ date: "2026-07-24", time: "19:00", workoutDays: [5], now }), "planned");
  assert.equal(scheduleDisplayStatus({ date: "2026-07-23", time: "19:00", workoutDays: [3, 5], now }), "unscheduled");
  assert.equal(scheduleDisplayStatus({ date: "2026-07-22", time: "19:00", explicitStatus: "completed", workoutDays: [3], now }), "completed");
});

test("finds the next planned occurrence and skips rest days", () => {
  const preferences = { workoutDays: [3, 5], preferredTime: "19:00", reminderMinutesBefore: 30, browserNotifications: false };
  const entries = [{ id: "rest", scheduledDate: "2026-07-22", scheduledTime: "19:00", status: "rest", originalDate: null, completedSessionId: null }];
  const next = nextWorkoutOccurrence(preferences, entries, new Date("2026-07-22T14:00:00Z"));
  assert.equal(next?.date, "2026-07-24");
  assert.equal(next?.time, "19:00");
});
