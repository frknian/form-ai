"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isNativeApp, mobileNotificationPermission, requestMobileNotificationPermission, scheduleMobileWorkouts } from "@/lib/mobile";
import { localClock, localDateKey, userTimeZone } from "@/lib/streak";
import {
  addCalendarDays,
  formatLocalDate,
  localWeek,
  nextWorkoutOccurrence,
  scheduleDisplayStatus,
  type DisplayScheduleStatus,
  type ReminderPreferences,
  type WorkoutScheduleEntry,
  type WorkoutScheduleStatus,
} from "@/lib/workout-calendar";
import { useTranslations, type Dictionary } from "@/lib/i18n/translate";
import { useLocale } from "@/lib/i18n/locale";

interface WorkoutCalendarProps {
  active: boolean;
  userId?: string;
  onStartWorkout: () => void;
}

const defaultPreferences: ReminderPreferences = { workoutDays: [1, 3, 5], preferredTime: "19:00", reminderMinutesBefore: 30, browserNotifications: false, timezone: "UTC" };

function statusLabel(t: Dictionary, status: DisplayScheduleStatus): string {
  if (status === "planned") return t.workoutCalendar.statusPlanned;
  if (status === "completed") return t.workoutCalendar.statusCompleted;
  if (status === "missed") return t.workoutCalendar.statusMissed;
  if (status === "rest") return t.workoutCalendar.statusRest;
  if (status === "deferred") return t.workoutCalendar.statusDeferred;
  return t.workoutCalendar.statusUnscheduled;
}

function zoneOffsetLabel(timeZone: string, at: Date | number = new Date()) {
  try {
    const part = new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "shortOffset" }).formatToParts(at).find((item) => item.type === "timeZoneName");
    return part ? part.value.replace("GMT", "UTC") : "UTC";
  } catch {
    return "UTC";
  }
}

function scheduleFromRow(row: Record<string, unknown>): WorkoutScheduleEntry {
  return { id: String(row.id), scheduledDate: String(row.scheduled_date), scheduledTime: String(row.scheduled_time).slice(0, 5), status: row.status as WorkoutScheduleStatus, originalDate: typeof row.original_date === "string" ? row.original_date : null, completedSessionId: typeof row.completed_session_id === "string" ? row.completed_session_id : null };
}

export function WorkoutCalendar({ active, userId, onStartWorkout }: WorkoutCalendarProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "tr-TR";
  const [preferences, setPreferences] = useState<ReminderPreferences>(defaultPreferences);
  const [entries, setEntries] = useState<WorkoutScheduleEntry[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [postponingDate, setPostponingDate] = useState<string | null>(null);
  const [postponeTarget, setPostponeTarget] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [showNotificationSettingsHelp, setShowNotificationSettingsHelp] = useState(false);
  const [todayHasActivity, setTodayHasActivity] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    const permissionTimer = window.setTimeout(() => { void mobileNotificationPermission().then(setNotificationPermission); }, 0);
    return () => { window.clearInterval(interval); window.clearTimeout(permissionTimer); };
  }, []);

  useEffect(() => {
    if (!postponingDate) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPostponingDate(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [postponingDate]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function loadCalendar() {
      const supabase = createClient();
      if (!supabase) { if (!cancelled) setLoading(false); return; }
      const today = localDateKey();
      const [{ data: preferenceRow, error: preferenceError }, { data: scheduleRows, error: scheduleError }] = await Promise.all([
        supabase.from("reminder_preferences").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("workout_schedule").select("*").eq("user_id", userId).gte("scheduled_date", addCalendarDays(today, -35)).lte("scheduled_date", addCalendarDays(today, 70)).order("scheduled_date", { ascending: true }),
      ]);
      if (cancelled) return;
      setLoading(false);
      if (preferenceError || scheduleError) { setError(t.workoutCalendar.calendarDataError); return; }
      const storedTimezone = typeof preferenceRow?.timezone === "string" && preferenceRow.timezone ? preferenceRow.timezone : "";
      const detectedTimezone = userTimeZone();
      const loadedPreferences = preferenceRow ? { workoutDays: Array.isArray(preferenceRow.workout_days) ? preferenceRow.workout_days.map(Number) : defaultPreferences.workoutDays, preferredTime: String(preferenceRow.preferred_time || defaultPreferences.preferredTime).slice(0, 5), reminderMinutesBefore: Number(preferenceRow.reminder_minutes_before || 30), browserNotifications: Boolean(preferenceRow.browser_notifications), timezone: detectedTimezone } : { ...defaultPreferences, timezone: detectedTimezone };
      const loadedEntries = (scheduleRows || []).map((row) => scheduleFromRow(row as Record<string, unknown>));
      setPreferences(loadedPreferences);
      setEntries(loadedEntries);
      await scheduleMobileWorkouts(loadedPreferences, loadedEntries).catch(() => undefined);
      // Konum bazlı saat dilimi: kullanıcı farklı bir cihaz/konumdan girdiyse
      // saklı değeri sessizce güncel cihazın saat dilimiyle tazele.
      if (preferenceRow && storedTimezone !== detectedTimezone) {
        await supabase.from("reminder_preferences").update({ timezone: detectedTimezone, updated_at: new Date().toISOString() }).eq("user_id", userId);
      }
    }
    void loadCalendar();
    return () => { cancelled = true; };
  }, [userId, t]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function loadTodayActivity() {
      const supabase = createClient();
      if (!supabase) return;
      const { data } = await supabase.from("activity_logs").select("id").eq("user_id", userId).eq("local_date", localDateKey()).limit(1);
      if (!cancelled) setTodayHasActivity(Boolean(data?.length));
    }
    function refreshActivity() { void loadTodayActivity(); }
    void loadTodayActivity();
    window.addEventListener("fit-ai-activity-recorded", refreshActivity);
    return () => { cancelled = true; window.removeEventListener("fit-ai-activity-recorded", refreshActivity); };
  }, [userId]);

  const weekDates = useMemo(() => localWeek(now, weekOffset), [now, weekOffset]);
  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.scheduledDate, entry])), [entries]);
  const upcoming = useMemo(() => nextWorkoutOccurrence(preferences, entries, now), [entries, now, preferences]);
  const reminderVisible = upcoming ? upcoming.startsAt.getTime() - now <= preferences.reminderMinutesBefore * 60_000 : false;

  useEffect(() => {
    if (isNativeApp() || !upcoming || !reminderVisible || !preferences.browserNotifications || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const key = `fit-ai-reminder:${upcoming.date}:${upcoming.time}`;
    if (window.localStorage.getItem(key)) return;
    const notification = new Notification(t.workoutCalendar.reminderUpcomingTitle, { body: t.workoutCalendar.reminderNotificationBody(upcoming.time), tag: key });
    window.localStorage.setItem(key, "shown");
    return () => notification.close();
  }, [preferences.browserNotifications, reminderVisible, upcoming, t]);

  useEffect(() => {
    if (isNativeApp() || !preferences.browserNotifications || notificationPermission !== "granted") return;
    const current = new Date(now);
    const date = localDateKey(current);
    const { hour, minute } = localClock(current);
    const notifyOnce = (key: string, title: string, body: string) => {
      if (window.localStorage.getItem(key)) return;
      new Notification(title, { body, tag: key });
      window.localStorage.setItem(key, "shown");
    };
    if (hour === 8 && minute < 5) notifyOnce(`fit-ai-morning:${date}`, t.workoutCalendar.morningNotifTitle, t.workoutCalendar.morningNotifBody);
    const localWeekday = ((current.getDay() + 6) % 7) + 1;
    const todayEntry = entryMap.get(localDateKey(now));
    const plannedToday = todayEntry?.status === "planned" || (!todayEntry && preferences.workoutDays.includes(localWeekday));
    if (hour === 12 && minute < 5 && plannedToday && !todayHasActivity) notifyOnce(`fit-ai-noon:${date}`, t.workoutCalendar.noonNotifTitle, t.workoutCalendar.noonNotifBody);
  }, [entryMap, notificationPermission, now, preferences.browserNotifications, preferences.workoutDays, todayHasActivity, t]);

  function toggleWorkoutDay(day: number) {
    setPreferences((current) => ({ ...current, workoutDays: current.workoutDays.includes(day) ? current.workoutDays.length === 1 ? current.workoutDays : current.workoutDays.filter((item) => item !== day) : [...current.workoutDays, day].sort() }));
  }

  async function savePreferences(nextPreferences = preferences) {
    if (!userId) return;
    const supabase = createClient();
    if (!supabase) { setError(t.workoutCalendar.secureConnectionError); return; }
    setSaving(true);
    setError("");
    setMessage("");
    const { error: preferenceError } = await supabase.from("reminder_preferences").upsert({ user_id: userId, workout_days: nextPreferences.workoutDays, preferred_time: nextPreferences.preferredTime, reminder_minutes_before: nextPreferences.reminderMinutesBefore, browser_notifications: nextPreferences.browserNotifications, timezone: userTimeZone(), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (preferenceError) { setSaving(false); setError(t.workoutCalendar.preferencesSaveError); return; }
    const dates = Array.from({ length: 9 }, (_, week) => localWeek(now, week)).flat().filter((date) => nextPreferences.workoutDays.includes(((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1));
    const desiredDates = new Set(dates);
    const today = localDateKey(now);
    const staleEntries = entries.filter((entry) => entry.status === "planned" && !entry.originalDate && entry.scheduledDate >= today && !desiredDates.has(entry.scheduledDate));
    if (staleEntries.length) await supabase.from("workout_schedule").delete().eq("user_id", userId).in("id", staleEntries.map((entry) => entry.id));
    const recurringEntries = entries.filter((entry) => entry.status === "planned" && !entry.originalDate && entry.scheduledDate >= today && desiredDates.has(entry.scheduledDate));
    if (recurringEntries.length) await supabase.from("workout_schedule").update({ scheduled_time: nextPreferences.preferredTime, updated_at: new Date().toISOString() }).eq("user_id", userId).in("id", recurringEntries.map((entry) => entry.id));
    const retainedEntries = entries.filter((entry) => !staleEntries.some((stale) => stale.id === entry.id)).map((entry) => recurringEntries.some((recurring) => recurring.id === entry.id) ? { ...entry, scheduledTime: nextPreferences.preferredTime } : entry);
    const existingDates = new Set(retainedEntries.map((entry) => entry.scheduledDate));
    const newRows = dates.filter((date) => !existingDates.has(date)).map((date) => ({ id: crypto.randomUUID(), user_id: userId, scheduled_date: date, scheduled_time: nextPreferences.preferredTime, status: "planned" }));
    const { data: inserted, error: scheduleError } = newRows.length ? await supabase.from("workout_schedule").insert(newRows).select("*") : { data: [], error: null };
    setSaving(false);
    if (scheduleError) { setError(t.workoutCalendar.schedulePlanError); return; }
    const nextEntries = [...retainedEntries, ...(inserted || []).map((row) => scheduleFromRow(row as Record<string, unknown>))].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    setEntries(nextEntries);
    await scheduleMobileWorkouts(nextPreferences, nextEntries).catch(() => setError(t.workoutCalendar.mobileScheduleError));
    setMessage(t.workoutCalendar.preferencesSaved);
  }

  async function requestNotificationPermission() {
    const permission = await requestMobileNotificationPermission();
    if (permission === "unsupported") { setPreferences((current) => ({ ...current, browserNotifications: false })); setError(t.workoutCalendar.notifUnsupportedMessage); return; }
    setNotificationPermission(permission);
    const next = { ...preferences, browserNotifications: permission === "granted" };
    setPreferences(next);
    await savePreferences(next);
    if (permission === "granted") setMessage(isNativeApp() ? t.workoutCalendar.mobileNotifOnMessage : t.workoutCalendar.browserNotifOnMessage);
    else { setShowNotificationSettingsHelp(true); setError(t.workoutCalendar.notifBlockedMessage); }
  }

  async function setBrowserNotifications(enabled: boolean) {
    if (enabled && notificationPermission !== "granted") {
      await requestNotificationPermission();
      return;
    }
    const next = { ...preferences, browserNotifications: enabled };
    setPreferences(next);
    await savePreferences(next);
    setMessage(enabled ? t.workoutCalendar.browserRemindersOnMessage : t.workoutCalendar.browserRemindersOffMessage);
  }

  function openNotificationSettingsHelp() {
    setShowNotificationSettingsHelp(true);
    if (!isNativeApp()) window.open("chrome://settings/content/notifications", "_blank", "noopener");
  }

  async function saveDayStatus(date: string, status: WorkoutScheduleStatus) {
    if (!userId) return false;
    const supabase = createClient();
    if (!supabase) return false;
    const existing = entryMap.get(date);
    const payload = { id: existing?.id || crypto.randomUUID(), user_id: userId, scheduled_date: date, scheduled_time: existing?.scheduledTime || preferences.preferredTime, status, original_date: existing?.originalDate || null, completed_session_id: existing?.completedSessionId || null, updated_at: new Date().toISOString() };
    const { data, error: statusError } = await supabase.from("workout_schedule").upsert(payload, { onConflict: "user_id,scheduled_date" }).select().single();
    if (statusError || !data) { setError(t.workoutCalendar.dayUpdateError); return false; }
    const next = scheduleFromRow(data as Record<string, unknown>);
    setEntries((current) => [...current.filter((entry) => entry.scheduledDate !== date), next].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)));
    return true;
  }

  async function postponeWorkout() {
    if (!userId || !postponingDate || !postponeTarget || postponeTarget <= postponingDate) { setError(t.workoutCalendar.postponeDateMustBeAfter); return; }
    if (entryMap.has(postponeTarget)) { setError(t.workoutCalendar.dateAlreadyScheduled); return; }
    const sourceSaved = await saveDayStatus(postponingDate, "deferred");
    if (!sourceSaved) return;
    const supabase = createClient();
    if (!supabase) return;
    const { data, error: postponeError } = await supabase.from("workout_schedule").insert({ id: crypto.randomUUID(), user_id: userId, scheduled_date: postponeTarget, scheduled_time: entryMap.get(postponingDate)?.scheduledTime || preferences.preferredTime, status: "planned", original_date: postponingDate }).select().single();
    if (postponeError || !data) { await saveDayStatus(postponingDate, "planned"); setError(t.workoutCalendar.newWorkoutDayError); return; }
    setEntries((current) => [...current, scheduleFromRow(data as Record<string, unknown>)].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)));
    setPostponingDate(null);
    setMessage(t.workoutCalendar.postponedMessage(formatLocalDate(postponeTarget, undefined, undefined, dateLocale)));
  }

  const reminderBanner = reminderVisible && upcoming ? <div className="workout-reminder-banner" role="status"><div><span>⏱</span><p><strong>{t.workoutCalendar.reminderUpcomingTitle}</strong>{t.workoutCalendar.reminderUpcomingBody(upcoming.time, preferences.timezone)}</p></div><button type="button" onClick={onStartWorkout}>{t.workoutCalendar.goToWorkout} →</button></div> : null;
  if (!active) return reminderBanner;

  return <div className="calendar-view subview">{reminderBanner}<div className="eyebrow">{t.workoutCalendar.eyebrow}</div><div className="calendar-title-row"><div><h1>{t.workoutCalendar.titlePart1}<em>{t.workoutCalendar.titlePart2}</em></h1><p className="lead">{t.workoutCalendar.lead}</p></div><span className="timezone-badge">{preferences.timezone} · {zoneOffsetLabel(preferences.timezone)}</span></div>
    {error && <div className="calendar-message error" role="alert">{error}</div>}{message && <div className="calendar-message" role="status">{message}</div>}
    <section className="calendar-settings" aria-labelledby="calendar-settings-title"><div><div className="eyebrow">{t.workoutCalendar.weeklyPreferencesEyebrow}</div><h2 id="calendar-settings-title">{t.workoutCalendar.whatDaysWork}</h2><div className="weekday-picker" role="group" aria-label={t.workoutCalendar.workoutDaysAriaLabel}>{t.workoutCalendar.weekdayLabels.map((label, index) => <button type="button" key={label} aria-pressed={preferences.workoutDays.includes(index + 1)} className={preferences.workoutDays.includes(index + 1) ? "active" : ""} onClick={() => toggleWorkoutDay(index + 1)}><span>{label.slice(0, 3)}</span><small>{label}</small></button>)}</div></div><div className="reminder-settings"><label>{t.workoutCalendar.workoutTimeLabel}<input type="time" value={preferences.preferredTime} onChange={(event) => setPreferences((current) => ({ ...current, preferredTime: event.target.value }))} /></label><label>{t.workoutCalendar.reminderLabel}<select value={preferences.reminderMinutesBefore} onChange={(event) => setPreferences((current) => ({ ...current, reminderMinutesBefore: Number(event.target.value) }))}><option value={10}>{t.workoutCalendar.reminder10}</option><option value={30}>{t.workoutCalendar.reminder30}</option><option value={60}>{t.workoutCalendar.reminder60}</option><option value={120}>{t.workoutCalendar.reminder120}</option></select></label><button className="calendar-save" type="button" disabled={saving} onClick={() => void savePreferences()}>{saving ? t.workoutCalendar.saving : t.workoutCalendar.savePreferences}</button></div></section>
    <section className="notification-card" aria-labelledby="notification-settings-title"><div><span className="notification-icon" aria-hidden="true">◉</span><div><strong id="notification-settings-title">{isNativeApp() ? t.workoutCalendar.mobileNotification : t.workoutCalendar.browserNotification}</strong><p>{isNativeApp() ? t.workoutCalendar.mobileNotificationBody : t.workoutCalendar.browserNotificationBody}</p></div></div><div className="notification-controls"><span className={`permission-status ${notificationPermission}`}>{notificationPermission === "granted" ? preferences.browserNotifications ? t.workoutCalendar.notifOn : t.workoutCalendar.notifGrantedOff : notificationPermission === "denied" ? t.workoutCalendar.notifDenied : notificationPermission === "unsupported" ? t.workoutCalendar.notifUnsupported : t.workoutCalendar.notifPending}</span>{notificationPermission === "default" && <button type="button" onClick={() => void requestNotificationPermission()}>{t.workoutCalendar.enableBrowserNotifications}</button>}{notificationPermission === "granted" && <button type="button" aria-pressed={preferences.browserNotifications} onClick={() => void setBrowserNotifications(!preferences.browserNotifications)}>{preferences.browserNotifications ? t.workoutCalendar.disableReminders : t.workoutCalendar.enableReminders}</button>}{notificationPermission === "denied" && <button type="button" onClick={openNotificationSettingsHelp}>{t.workoutCalendar.goToBrowserSettings}</button>}{notificationPermission === "unsupported" && <span className="notification-fallback">{t.workoutCalendar.inAppFallback}</span>}</div>{notificationPermission === "default" && <p className="notification-consent">{t.workoutCalendar.consentNote}</p>}{(notificationPermission === "denied" || showNotificationSettingsHelp) && <div className="notification-settings-help" role="status"><strong>{t.workoutCalendar.howToEnablePermission}</strong><span>{t.workoutCalendar.permissionHelpBody}</span></div>}</section>
    <section className="weekly-calendar" aria-labelledby="weekly-calendar-title"><div className="weekly-calendar-head"><button type="button" aria-label={t.workoutCalendar.previousWeek} onClick={() => setWeekOffset((current) => current - 1)}>←</button><div><span id="weekly-calendar-title">{formatLocalDate(weekDates[0], undefined, undefined, dateLocale)} – {formatLocalDate(weekDates[6], { day: "numeric", month: "long", year: "numeric" }, undefined, dateLocale)}</span><small>{weekOffset === 0 ? t.workoutCalendar.thisWeek : weekOffset > 0 ? t.workoutCalendar.weeksAfter(weekOffset) : t.workoutCalendar.weeksBefore(Math.abs(weekOffset))}</small></div><button type="button" aria-label={t.workoutCalendar.nextWeek} onClick={() => setWeekOffset((current) => current + 1)}>→</button></div><div className="calendar-legend" aria-label={t.workoutCalendar.legendAriaLabel}><span className="planned">{t.workoutCalendar.legendPlanned}</span><span className="completed">{t.workoutCalendar.legendCompleted}</span><span className="missed">{t.workoutCalendar.legendMissed}</span><span className="rest">{t.workoutCalendar.legendRest}</span></div>{loading ? <div className="calendar-loading">{t.workoutCalendar.calendarLoading}</div> : <div className="calendar-week-grid">{weekDates.map((date, index) => { const entry = entryMap.get(date); const time = entry?.scheduledTime || preferences.preferredTime; const status = scheduleDisplayStatus({ date, time, explicitStatus: entry?.status, workoutDays: preferences.workoutDays, now }); const actionable = status === "planned" || status === "missed"; return <article key={date} className={`calendar-day ${status} ${date === localDateKey(now) ? "today" : ""}`}><header><span>{t.workoutCalendar.weekdayLabels[index]}</span><strong>{formatLocalDate(date, { day: "numeric" }, undefined, dateLocale)}</strong></header><div className="calendar-day-status"><i />{statusLabel(t, status)}</div>{status !== "unscheduled" && <p>{status === "deferred" ? t.workoutCalendar.movedToNewDay : status === "rest" ? t.workoutCalendar.recoveryDay : status === "completed" ? t.workoutCalendar.workoutRecorded : t.workoutCalendar.workoutAt(time)}</p>}{entry?.originalDate && <small>{t.workoutCalendar.movedFrom(formatLocalDate(entry.originalDate, undefined, undefined, dateLocale))}</small>}{actionable && <div className="calendar-day-actions"><button type="button" onClick={() => { setError(""); setPostponingDate(date); setPostponeTarget(addCalendarDays(date, 1)); }}>{t.workoutCalendar.postpone}</button><button type="button" onClick={() => void saveDayStatus(date, "rest")}>{t.workoutCalendar.rest}</button></div>}</article>; })}</div>}</section>
    <aside className="background-reminder-note"><strong>{isNativeApp() ? t.workoutCalendar.localRemindersReady : t.workoutCalendar.backgroundNotifTitle}</strong><p>{isNativeApp() ? t.workoutCalendar.localRemindersBody : t.workoutCalendar.backgroundNotifBody}</p></aside>
    {postponingDate && <div className="postpone-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPostponingDate(null); }}><div className="postpone-dialog" role="dialog" aria-modal="true" aria-labelledby="postpone-title"><button type="button" className="postpone-close" aria-label={t.workoutCalendar.closeDialog} onClick={() => setPostponingDate(null)}>×</button><div className="eyebrow">{t.workoutCalendar.postponeDialogEyebrow}</div><h2 id="postpone-title">{t.workoutCalendar.selectNewDay}</h2><p>{t.workoutCalendar.postponeDialogBody(formatLocalDate(postponingDate, undefined, undefined, dateLocale))}</p><label>{t.workoutCalendar.newDateLabel}<input type="date" min={addCalendarDays(postponingDate, 1)} value={postponeTarget} onChange={(event) => setPostponeTarget(event.target.value)} /></label><div><button type="button" onClick={() => setPostponingDate(null)}>{t.workoutCalendar.cancel}</button><button type="button" onClick={() => void postponeWorkout()}>{t.workoutCalendar.confirmPostpone}</button></div></div></div>}
  </div>;
}
