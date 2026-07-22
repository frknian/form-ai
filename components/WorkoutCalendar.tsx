"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isNativeApp, mobileNotificationPermission, requestMobileNotificationPermission, scheduleMobileWorkouts } from "@/lib/mobile";
import { localClock, localDateKey } from "@/lib/streak";
import {
  addCalendarDays,
  formatIstanbulDate,
  istanbulDateKey,
  istanbulWeek,
  nextWorkoutOccurrence,
  scheduleDisplayStatus,
  weekdayLabels,
  type DisplayScheduleStatus,
  type ReminderPreferences,
  type WorkoutScheduleEntry,
  type WorkoutScheduleStatus,
} from "@/lib/workout-calendar";

interface WorkoutCalendarProps {
  active: boolean;
  userId?: string;
  onStartWorkout: () => void;
}

const defaultPreferences: ReminderPreferences = { workoutDays: [1, 3, 5], preferredTime: "19:00", reminderMinutesBefore: 30, browserNotifications: false };
const statusLabels: Record<DisplayScheduleStatus, string> = { planned: "Planlandı", completed: "Tamamlandı", missed: "Kaçırıldı", rest: "Dinlenme", deferred: "Ertelendi", unscheduled: "Boş gün" };

function scheduleFromRow(row: Record<string, unknown>): WorkoutScheduleEntry {
  return { id: String(row.id), scheduledDate: String(row.scheduled_date), scheduledTime: String(row.scheduled_time).slice(0, 5), status: row.status as WorkoutScheduleStatus, originalDate: typeof row.original_date === "string" ? row.original_date : null, completedSessionId: typeof row.completed_session_id === "string" ? row.completed_session_id : null };
}

export function WorkoutCalendar({ active, userId, onStartWorkout }: WorkoutCalendarProps) {
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
      const today = istanbulDateKey();
      const [{ data: preferenceRow, error: preferenceError }, { data: scheduleRows, error: scheduleError }] = await Promise.all([
        supabase.from("reminder_preferences").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("workout_schedule").select("*").eq("user_id", userId).gte("scheduled_date", addCalendarDays(today, -35)).lte("scheduled_date", addCalendarDays(today, 70)).order("scheduled_date", { ascending: true }),
      ]);
      if (cancelled) return;
      setLoading(false);
      if (preferenceError || scheduleError) { setError("Takvim verilerin şu anda yüklenemedi. Supabase takvim tablolarının kurulu olduğunu kontrol et."); return; }
      const loadedPreferences = preferenceRow ? { workoutDays: Array.isArray(preferenceRow.workout_days) ? preferenceRow.workout_days.map(Number) : defaultPreferences.workoutDays, preferredTime: String(preferenceRow.preferred_time || defaultPreferences.preferredTime).slice(0, 5), reminderMinutesBefore: Number(preferenceRow.reminder_minutes_before || 30), browserNotifications: Boolean(preferenceRow.browser_notifications) } : defaultPreferences;
      const loadedEntries = (scheduleRows || []).map((row) => scheduleFromRow(row as Record<string, unknown>));
      setPreferences(loadedPreferences);
      setEntries(loadedEntries);
      await scheduleMobileWorkouts(loadedPreferences, loadedEntries).catch(() => undefined);
    }
    void loadCalendar();
    return () => { cancelled = true; };
  }, [userId]);

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

  const weekDates = useMemo(() => istanbulWeek(now, weekOffset), [now, weekOffset]);
  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.scheduledDate, entry])), [entries]);
  const upcoming = useMemo(() => nextWorkoutOccurrence(preferences, entries, now), [entries, now, preferences]);
  const reminderVisible = upcoming ? upcoming.startsAt.getTime() - now <= preferences.reminderMinutesBefore * 60_000 : false;

  useEffect(() => {
    if (isNativeApp() || !upcoming || !reminderVisible || !preferences.browserNotifications || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const key = `fit-ai-reminder:${upcoming.date}:${upcoming.time}`;
    if (window.localStorage.getItem(key)) return;
    const notification = new Notification("Antrenman saatin yaklaşıyor", { body: `Bugünkü antrenmanın ${upcoming.time} için planlandı. Hazırlanmaya başlayabilirsin.`, tag: key });
    window.localStorage.setItem(key, "shown");
    return () => notification.close();
  }, [preferences.browserNotifications, reminderVisible, upcoming]);

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
    if (hour === 8 && minute < 5) notifyOnce(`fit-ai-morning:${date}`, "Güne hazır mısınız?", "Bugünkü hareket planına küçük bir adımla başlayabilirsin.");
    const localWeekday = ((current.getDay() + 6) % 7) + 1;
    const todayEntry = entryMap.get(istanbulDateKey(now));
    const plannedToday = todayEntry?.status === "planned" || (!todayEntry && preferences.workoutDays.includes(localWeekday));
    if (hour === 12 && minute < 5 && plannedToday && !todayHasActivity) notifyOnce(`fit-ai-noon:${date}`, "Bugünkü antrenmanını unutma", "Planlı antrenmanın için henüz bir aktivite kaydı görünmüyor. Uygun olduğunda başlayabilirsin.");
  }, [entryMap, notificationPermission, now, preferences.browserNotifications, preferences.workoutDays, todayHasActivity]);

  function toggleWorkoutDay(day: number) {
    setPreferences((current) => ({ ...current, workoutDays: current.workoutDays.includes(day) ? current.workoutDays.length === 1 ? current.workoutDays : current.workoutDays.filter((item) => item !== day) : [...current.workoutDays, day].sort() }));
  }

  async function savePreferences(nextPreferences = preferences) {
    if (!userId) return;
    const supabase = createClient();
    if (!supabase) { setError("Güvenli veri bağlantısı kurulamadı."); return; }
    setSaving(true);
    setError("");
    setMessage("");
    const { error: preferenceError } = await supabase.from("reminder_preferences").upsert({ user_id: userId, workout_days: nextPreferences.workoutDays, preferred_time: nextPreferences.preferredTime, reminder_minutes_before: nextPreferences.reminderMinutesBefore, browser_notifications: nextPreferences.browserNotifications, timezone: "Europe/Istanbul", updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (preferenceError) { setSaving(false); setError("Takvim tercihlerin kaydedilemedi."); return; }
    const dates = Array.from({ length: 9 }, (_, week) => istanbulWeek(now, week)).flat().filter((date) => nextPreferences.workoutDays.includes(((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1));
    const desiredDates = new Set(dates);
    const today = istanbulDateKey(now);
    const staleEntries = entries.filter((entry) => entry.status === "planned" && !entry.originalDate && entry.scheduledDate >= today && !desiredDates.has(entry.scheduledDate));
    if (staleEntries.length) await supabase.from("workout_schedule").delete().eq("user_id", userId).in("id", staleEntries.map((entry) => entry.id));
    const recurringEntries = entries.filter((entry) => entry.status === "planned" && !entry.originalDate && entry.scheduledDate >= today && desiredDates.has(entry.scheduledDate));
    if (recurringEntries.length) await supabase.from("workout_schedule").update({ scheduled_time: nextPreferences.preferredTime, updated_at: new Date().toISOString() }).eq("user_id", userId).in("id", recurringEntries.map((entry) => entry.id));
    const retainedEntries = entries.filter((entry) => !staleEntries.some((stale) => stale.id === entry.id)).map((entry) => recurringEntries.some((recurring) => recurring.id === entry.id) ? { ...entry, scheduledTime: nextPreferences.preferredTime } : entry);
    const existingDates = new Set(retainedEntries.map((entry) => entry.scheduledDate));
    const newRows = dates.filter((date) => !existingDates.has(date)).map((date) => ({ id: crypto.randomUUID(), user_id: userId, scheduled_date: date, scheduled_time: nextPreferences.preferredTime, status: "planned" }));
    const { data: inserted, error: scheduleError } = newRows.length ? await supabase.from("workout_schedule").insert(newRows).select("*") : { data: [], error: null };
    setSaving(false);
    if (scheduleError) { setError("Tercihler kaydedildi ancak plan günleri oluşturulamadı."); return; }
    const nextEntries = [...retainedEntries, ...(inserted || []).map((row) => scheduleFromRow(row as Record<string, unknown>))].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    setEntries(nextEntries);
    await scheduleMobileWorkouts(nextPreferences, nextEntries).catch(() => setError("Takvim kaydedildi ancak mobil bildirimler planlanamadı."));
    setMessage("Takvim ve hatırlatma tercihlerin kaydedildi.");
  }

  async function requestNotificationPermission() {
    const permission = await requestMobileNotificationPermission();
    if (permission === "unsupported") { setPreferences((current) => ({ ...current, browserNotifications: false })); setError("Bu tarayıcı veya bağlantı türü bildirimleri desteklemiyor. Uygulama içi hatırlatmalar devam edecek."); return; }
    setNotificationPermission(permission);
    const next = { ...preferences, browserNotifications: permission === "granted" };
    setPreferences(next);
    await savePreferences(next);
    if (permission === "granted") setMessage(isNativeApp() ? "Mobil antrenman bildirimleri açıldı." : "Tarayıcı bildirimleri açıldı.");
    else { setShowNotificationSettingsHelp(true); setError("Bildirim izni engellendi. Tarayıcı ayarlarından FİT.AI için izni açabilirsin."); }
  }

  async function setBrowserNotifications(enabled: boolean) {
    if (enabled && notificationPermission !== "granted") {
      await requestNotificationPermission();
      return;
    }
    const next = { ...preferences, browserNotifications: enabled };
    setPreferences(next);
    await savePreferences(next);
    setMessage(enabled ? "Tarayıcı hatırlatmaları açıldı." : "Tarayıcı hatırlatmaları kapatıldı. Uygulama içi uyarılar devam eder.");
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
    if (statusError || !data) { setError("Takvim günü güncellenemedi."); return false; }
    const next = scheduleFromRow(data as Record<string, unknown>);
    setEntries((current) => [...current.filter((entry) => entry.scheduledDate !== date), next].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)));
    return true;
  }

  async function postponeWorkout() {
    if (!userId || !postponingDate || !postponeTarget || postponeTarget <= postponingDate) { setError("Erteleme tarihi seçtiğin günden sonra olmalı."); return; }
    if (entryMap.has(postponeTarget)) { setError("Seçtiğin tarihte zaten bir takvim kaydı var."); return; }
    const sourceSaved = await saveDayStatus(postponingDate, "deferred");
    if (!sourceSaved) return;
    const supabase = createClient();
    if (!supabase) return;
    const { data, error: postponeError } = await supabase.from("workout_schedule").insert({ id: crypto.randomUUID(), user_id: userId, scheduled_date: postponeTarget, scheduled_time: entryMap.get(postponingDate)?.scheduledTime || preferences.preferredTime, status: "planned", original_date: postponingDate }).select().single();
    if (postponeError || !data) { await saveDayStatus(postponingDate, "planned"); setError("Yeni antrenman günü oluşturulamadı; eski planın korundu."); return; }
    setEntries((current) => [...current, scheduleFromRow(data as Record<string, unknown>)].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)));
    setPostponingDate(null);
    setMessage(`Antrenman ${formatIstanbulDate(postponeTarget)} tarihine ertelendi.`);
  }

  const reminderBanner = reminderVisible && upcoming ? <div className="workout-reminder-banner" role="status"><div><span>⏱</span><p><strong>Antrenman saatin yaklaşıyor</strong>Bugün {upcoming.time} · Europe/Istanbul</p></div><button type="button" onClick={onStartWorkout}>Antrenmana git →</button></div> : null;
  if (!active) return reminderBanner;

  return <div className="calendar-view subview">{reminderBanner}<div className="eyebrow">ANTRENMAN TAKVİMİ</div><div className="calendar-title-row"><div><h1>Haftanı <em>ritmine göre planla.</em></h1><p className="lead">Antrenman günlerini seç, saatini ayarla ve kaçırdığın günleri kolayca yeniden planla.</p></div><span className="timezone-badge">Europe/Istanbul · UTC+3</span></div>
    {error && <div className="calendar-message error" role="alert">{error}</div>}{message && <div className="calendar-message" role="status">{message}</div>}
    <section className="calendar-settings" aria-labelledby="calendar-settings-title"><div><div className="eyebrow">HAFTALIK TERCİHLER</div><h2 id="calendar-settings-title">Hangi günler uygunsun?</h2><div className="weekday-picker" role="group" aria-label="Antrenman günleri">{weekdayLabels.map((label, index) => <button type="button" key={label} aria-pressed={preferences.workoutDays.includes(index + 1)} className={preferences.workoutDays.includes(index + 1) ? "active" : ""} onClick={() => toggleWorkoutDay(index + 1)}><span>{label.slice(0, 3)}</span><small>{label}</small></button>)}</div></div><div className="reminder-settings"><label>Antrenman saati<input type="time" value={preferences.preferredTime} onChange={(event) => setPreferences((current) => ({ ...current, preferredTime: event.target.value }))} /></label><label>Hatırlatma<select value={preferences.reminderMinutesBefore} onChange={(event) => setPreferences((current) => ({ ...current, reminderMinutesBefore: Number(event.target.value) }))}><option value={10}>10 dakika önce</option><option value={30}>30 dakika önce</option><option value={60}>1 saat önce</option><option value={120}>2 saat önce</option></select></label><button className="calendar-save" type="button" disabled={saving} onClick={() => void savePreferences()}>{saving ? "Kaydediliyor…" : "Tercihleri kaydet"}</button></div></section>
    <section className="notification-card" aria-labelledby="notification-settings-title"><div><span className="notification-icon" aria-hidden="true">◉</span><div><strong id="notification-settings-title">{isNativeApp() ? "Mobil bildirim" : "Tarayıcı bildirimi"}</strong><p>{isNativeApp() ? "Planladığın antrenmanlar uygulama kapalıyken de cihazında yerel hatırlatma olarak görünür." : "Uygulama açıkken yaklaşan antrenmanını bildirir. Kapalı tarayıcı için sunucu tabanlı web push gerekir."}</p></div></div><div className="notification-controls"><span className={`permission-status ${notificationPermission}`}>{notificationPermission === "granted" ? preferences.browserNotifications ? "Açık" : "İzin verildi · Kapalı" : notificationPermission === "denied" ? "Engellendi" : notificationPermission === "unsupported" ? "Desteklenmiyor" : "İzin bekliyor"}</span>{notificationPermission === "default" && <button type="button" onClick={() => void requestNotificationPermission()}>Tarayıcı bildirimlerini aç</button>}{notificationPermission === "granted" && <button type="button" aria-pressed={preferences.browserNotifications} onClick={() => void setBrowserNotifications(!preferences.browserNotifications)}>{preferences.browserNotifications ? "Hatırlatmaları kapat" : "Hatırlatmaları aç"}</button>}{notificationPermission === "denied" && <button type="button" onClick={openNotificationSettingsHelp}>Tarayıcı ayarlarına git</button>}{notificationPermission === "unsupported" && <span className="notification-fallback">Uygulama içi hatırlatma kullanılacak.</span>}</div>{notificationPermission === "default" && <p className="notification-consent">Aç düğmesine bastığında tarayıcın izin ister. İzin vermeden bildirim gönderilmez.</p>}{(notificationPermission === "denied" || showNotificationSettingsHelp) && <div className="notification-settings-help" role="status"><strong>İzni nasıl açarsın?</strong><span>Adres çubuğundaki ayar veya kilit simgesini aç, Bildirimler seçeneğini bul ve FİT.AI için “İzin ver”i seç. Ayarlar sayfası açılmazsa tarayıcının Ayarlar → Site ayarları → Bildirimler bölümünü kullan.</span></div>}</section>
    <section className="weekly-calendar" aria-labelledby="weekly-calendar-title"><div className="weekly-calendar-head"><button type="button" aria-label="Önceki hafta" onClick={() => setWeekOffset((current) => current - 1)}>←</button><div><span id="weekly-calendar-title">{formatIstanbulDate(weekDates[0])} – {formatIstanbulDate(weekDates[6], { day: "numeric", month: "long", year: "numeric" })}</span><small>{weekOffset === 0 ? "Bu hafta" : weekOffset > 0 ? `${weekOffset} hafta sonra` : `${Math.abs(weekOffset)} hafta önce`}</small></div><button type="button" aria-label="Sonraki hafta" onClick={() => setWeekOffset((current) => current + 1)}>→</button></div><div className="calendar-legend" aria-label="Takvim durumları"><span className="planned">Planlı</span><span className="completed">Tamamlandı</span><span className="missed">Kaçırıldı</span><span className="rest">Dinlenme</span></div>{loading ? <div className="calendar-loading">Takvimin yükleniyor…</div> : <div className="calendar-week-grid">{weekDates.map((date, index) => { const entry = entryMap.get(date); const time = entry?.scheduledTime || preferences.preferredTime; const status = scheduleDisplayStatus({ date, time, explicitStatus: entry?.status, workoutDays: preferences.workoutDays, now }); const actionable = status === "planned" || status === "missed"; return <article key={date} className={`calendar-day ${status} ${date === istanbulDateKey(now) ? "today" : ""}`}><header><span>{weekdayLabels[index]}</span><strong>{formatIstanbulDate(date, { day: "numeric" })}</strong></header><div className="calendar-day-status"><i />{statusLabels[status]}</div>{status !== "unscheduled" && <p>{status === "deferred" ? "Yeni güne taşındı" : status === "rest" ? "Toparlanma günü" : status === "completed" ? "Antrenman kaydedildi" : `${time} · Antrenman`}</p>}{entry?.originalDate && <small>{formatIstanbulDate(entry.originalDate)} tarihinden</small>}{actionable && <div className="calendar-day-actions"><button type="button" onClick={() => { setError(""); setPostponingDate(date); setPostponeTarget(addCalendarDays(date, 1)); }}>Ertele</button><button type="button" onClick={() => void saveDayStatus(date, "rest")}>Dinlenme</button></div>}</article>; })}</div>}</section>
    <aside className="background-reminder-note"><strong>{isNativeApp() ? "Yerel hatırlatmalar hazır" : "Arka plan bildirimi hakkında"}</strong><p>{isNativeApp() ? "Tercihlerini kaydettiğinde gelecek antrenmanlar cihazına planlanır. Saat değiştirirsen bildirimler otomatik yenilenir." : "Uygulama kapalıyken güvenilir web bildirimi için servis worker, web push aboneliği ve sunucu tarafında zamanlanmış gönderim gerekir."}</p></aside>
    {postponingDate && <div className="postpone-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPostponingDate(null); }}><div className="postpone-dialog" role="dialog" aria-modal="true" aria-labelledby="postpone-title"><button type="button" className="postpone-close" aria-label="Pencereyi kapat" onClick={() => setPostponingDate(null)}>×</button><div className="eyebrow">ANTRENMANI ERTELE</div><h2 id="postpone-title">Yeni günü seç</h2><p>{formatIstanbulDate(postponingDate)} tarihli planın seçtiğin yeni güne taşınacak.</p><label>Yeni tarih<input type="date" min={addCalendarDays(postponingDate, 1)} value={postponeTarget} onChange={(event) => setPostponeTarget(event.target.value)} /></label><div><button type="button" onClick={() => setPostponingDate(null)}>Vazgeç</button><button type="button" onClick={() => void postponeWorkout()}>Antrenmanı ertele</button></div></div></div>}
  </div>;
}
