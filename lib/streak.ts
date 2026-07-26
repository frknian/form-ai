export type ActivityType = "workout" | "walk" | "sport";

export function userTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

export function localDateKey(date: Date | number = new Date(), timeZone = userTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (part: string) => parts.find((item) => item.type === part)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function localClock(date: Date | number = new Date(), timeZone = userTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (part: string) => Number(parts.find((item) => item.type === part)?.value || 0);
  return { hour: value("hour"), minute: value("minute") };
}

export function shouldFreezeStreak(gapStatuses: Array<"rest" | "planned" | "completed" | "deferred" | undefined>) {
  return gapStatuses.every((status) => status === "rest");
}

export function nextStreakValue(current: number, sameDay: boolean, gapStatuses: Array<"rest" | "planned" | "completed" | "deferred" | undefined>) {
  if (sameDay) return Math.max(1, current);
  return shouldFreezeStreak(gapStatuses) ? Math.max(1, current) + 1 : 1;
}
