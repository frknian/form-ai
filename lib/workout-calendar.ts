export const ISTANBUL_TIME_ZONE = "Europe/Istanbul";
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
}

function datePartsInZone(input: Date | number, timeZone = ISTANBUL_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(input);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])) as Record<"year" | "month" | "day", string>;
}

export function istanbulDateKey(input: Date | number = new Date()) {
  const parts = datePartsInZone(input);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function istanbulTimeKey(input: Date | number = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: ISTANBUL_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(input);
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

export function istanbulWeek(reference: Date | number = new Date(), weekOffset = 0) {
  const current = istanbulDateKey(reference);
  const monday = addCalendarDays(current, -(isoWeekday(current) - 1) + weekOffset * 7);
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(monday, index));
}

function zonedDateTimeParts(input: Date | number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(input);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)])) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

export function istanbulDateTime(dateKey: string, time: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shown = zonedDateTimeParts(guess, ISTANBUL_TIME_ZONE);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    guess += target - shownAsUtc;
  }
  return new Date(guess);
}

export function scheduleDisplayStatus(input: { date: string; time: string; explicitStatus?: WorkoutScheduleStatus; workoutDays: number[]; now?: Date | number }): DisplayScheduleStatus {
  const { date, time, explicitStatus, workoutDays, now = new Date() } = input;
  if (explicitStatus === "completed" || explicitStatus === "rest" || explicitStatus === "deferred") return explicitStatus;
  const scheduled = explicitStatus === "planned" || workoutDays.includes(isoWeekday(date));
  if (!scheduled) return "unscheduled";
  return istanbulDateTime(date, time).getTime() < new Date(now).getTime() ? "missed" : "planned";
}

export function nextWorkoutOccurrence(preferences: ReminderPreferences, entries: WorkoutScheduleEntry[], now: Date | number = new Date()) {
  const nowTime = new Date(now).getTime();
  const startDate = istanbulDateKey(now);
  const entryMap = new Map(entries.map((entry) => [entry.scheduledDate, entry]));
  const candidates = Array.from({ length: 15 }, (_, index) => addCalendarDays(startDate, index)).flatMap((date) => {
    const entry = entryMap.get(date);
    const time = entry?.scheduledTime || preferences.preferredTime;
    const status = scheduleDisplayStatus({ date, time, explicitStatus: entry?.status, workoutDays: preferences.workoutDays, now });
    if (status !== "planned") return [];
    const startsAt = istanbulDateTime(date, time);
    return startsAt.getTime() >= nowTime ? [{ date, time, startsAt, entry }] : [];
  });
  return candidates.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0] || null;
}

export function formatIstanbulDate(dateKey: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("tr-TR", { ...options, timeZone: ISTANBUL_TIME_ZONE }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
