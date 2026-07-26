import { localDateKey, userTimeZone } from "./streak.ts";

export const weekdayLabels = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"] as const;

export type WorkoutScheduleStatus = "planned" | "completed" | "rest" | "deferred";
export type DisplayScheduleStatus = WorkoutScheduleStatus | "missed" | "unscheduled";

export interface WorkoutScheduleEntry {
  id: string;
  scheduledDate: string;
  scheduledTime: string;
  status: WorkoutScheduleStatus;
  originalDate: string | null;
  completedSessionId: string | null;
}

export interface ReminderPreferences {
  workoutDays: number[];
  preferredTime: string;
  reminderMinutesBefore: number;
  browserNotifications: boolean;
  /** Kullanıcının cihazından algılanan IANA saat dilimi, ör. "Europe/Istanbul". */
  timezone: string;
}

export function localTimeKey(input: Date | number = new Date(), timeZone: string = userTimeZone()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(input);
}

export function addCalendarDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function isoWeekday(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return ((new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay() + 6) % 7) + 1;
}

export function localWeek(reference: Date | number = new Date(), weekOffset = 0, timeZone: string = userTimeZone()) {
  const current = localDateKey(reference, timeZone);
  const monday = addCalendarDays(current, -(isoWeekday(current) - 1) + weekOffset * 7);
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(monday, index));
}

function zonedDateTimeParts(input: Date | number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(input);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)])) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

export function zonedDateTime(dateKey: string, time: string, timeZone: string = userTimeZone()) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shown = zonedDateTimeParts(guess, timeZone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    guess += target - shownAsUtc;
  }
  return new Date(guess);
}

export function scheduleDisplayStatus(input: { date: string; time: string; explicitStatus?: WorkoutScheduleStatus; workoutDays: number[]; now?: Date | number; timeZone?: string }): DisplayScheduleStatus {
  const { date, time, explicitStatus, workoutDays, now = new Date(), timeZone = userTimeZone() } = input;
  if (explicitStatus === "completed" || explicitStatus === "rest" || explicitStatus === "deferred") return explicitStatus;
  const scheduled = explicitStatus === "planned" || workoutDays.includes(isoWeekday(date));
  if (!scheduled) return "unscheduled";
  return zonedDateTime(date, time, timeZone).getTime() < new Date(now).getTime() ? "missed" : "planned";
}

export function nextWorkoutOccurrence(preferences: ReminderPreferences, entries: WorkoutScheduleEntry[], now: Date | number = new Date(), timeZone: string = preferences.timezone || userTimeZone()) {
  const nowTime = new Date(now).getTime();
  const startDate = localDateKey(now, timeZone);
  const entryMap = new Map(entries.map((entry) => [entry.scheduledDate, entry]));
  const candidates = Array.from({ length: 15 }, (_, index) => addCalendarDays(startDate, index)).flatMap((date) => {
    const entry = entryMap.get(date);
    const time = entry?.scheduledTime || preferences.preferredTime;
    const status = scheduleDisplayStatus({ date, time, explicitStatus: entry?.status, workoutDays: preferences.workoutDays, now, timeZone });
    if (status !== "planned") return [];
    const startsAt = zonedDateTime(date, time, timeZone);
    return startsAt.getTime() >= nowTime ? [{ date, time, startsAt, entry }] : [];
  });
  return candidates.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0] || null;
}

export function formatLocalDate(dateKey: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }, timeZone: string = userTimeZone(), locale = "tr-TR") {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
