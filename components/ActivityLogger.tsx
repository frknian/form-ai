"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createActivityRepository, summarizeActivities, type ActivityEntry } from "@/lib/activity-service";
import { activityIntensityOptions, coreActivityCatalog, estimateActivityCalories, sportCatalog, sportByKey, validActivityDuration, type SportDefinition, type SportMetricKey } from "@/lib/sports";
import { localDateKey, userTimeZone, type ActivityType } from "@/lib/streak";

type LoggerMode = "closed" | "guide" | "form";
type StreakRow = { current_streak?: number };
type MetricValues = Partial<Record<SportMetricKey, string>>;

function activityByKey(key: string): SportDefinition | null {
  return coreActivityCatalog.find((activity) => activity.key === key) || sportByKey(key);
}

function numberOrNull(value: string) {
  const number = Number(value);
  return value !== "" && Number.isFinite(number) && number >= 0 ? number : null;
}

function formatActivityDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", weekday: "short" }).format(new Date(`${value}T12:00:00`));
}

export function ActivityLogger({ userId, weightKg = 70 }: { userId?: string; weightKg?: number }) {
  const [mode, setMode] = useState<LoggerMode>("closed");
  const [activityKey, setActivityKey] = useState("");
  const [duration, setDuration] = useState("30");
  const [distance, setDistance] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [caloriesManual, setCaloriesManual] = useState(false);
  const [steps, setSteps] = useState("");
  const [intensity, setIntensity] = useState<(typeof activityIntensityOptions)[number]>("Orta");
  const [metrics, setMetrics] = useState<MetricValues>({});
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<ActivityEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selectedActivity = activityByKey(activityKey);
  const dailySummaries = summarizeActivities(history);
  const automaticCalories = selectedActivity ? estimateActivityCalories(selectedActivity.key, Number(duration), weightKg, intensity) : 0;
  const calories = caloriesManual ? manualCalories : automaticCalories ? String(automaticCalories) : "";

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    async function loadHistory() {
      const client = createClient();
      if (!client) { setHistoryLoading(false); return; }
      try {
        const entries = await createActivityRepository(client, userId as string).list();
        if (!cancelled) setHistory(entries);
      } catch {
        if (!cancelled) setMessage("Aktivite geçmişi şu an yüklenemedi.");
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }
    void loadHistory();
    return () => { cancelled = true; };
  }, [userId]);

  function resetForm(nextMode: LoggerMode) {
    setMode(nextMode);
    setDuration("30");
    setDistance("");
    setManualCalories("");
    setCaloriesManual(false);
    setSteps("");
    setIntensity("Orta");
    setMetrics({});
    setNotes("");
    setMessage("");
  }

  function selectActivity(key: string) {
    setActivityKey(key);
    resetForm("form");
  }

  function setMetric(key: SportMetricKey, value: string) {
    setMetrics((current) => ({ ...current, [key]: value }));
  }

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validActivityDuration(duration)) { setMessage("Süreyi 1–1440 dakika arasında gir."); return; }
    if (!selectedActivity) { setMessage("Kaydetmek istediğin aktiviteyi seç."); return; }
    if (!userId) { setMessage("Aktivite kaydı için hesabınla giriş yapmalısın."); return; }
    const activityType: ActivityType = selectedActivity.key === "walking" ? "walk" : "sport";
    const numericDetails = Object.fromEntries(Object.entries(metrics).flatMap(([key, value]) => {
      const numericValue = numberOrNull(value);
      return numericValue === null ? [] : [[key, numericValue]];
    }));

    setSaving(true);
    setMessage("");
    const client = createClient();
    if (!client) { setSaving(false); setMessage("Kayıt servisine ulaşılamadı."); return; }
    const occurredAt = new Date().toISOString();
    try {
      const entry = await createActivityRepository(client, userId).create({
        activityType,
        activityKey: selectedActivity.key,
        activityName: selectedActivity.name,
        occurredAt,
        localDate: localDateKey(new Date(occurredAt), userTimeZone()),
        durationMinutes: Number(duration),
        distanceKm: numberOrNull(distance),
        estimatedCalories: numberOrNull(calories),
        steps: numberOrNull(steps),
        intensity: intensity.toLocaleLowerCase("tr-TR").replace("ü", "u") as "hafif" | "orta" | "yuksek",
        notes: notes.trim() || null,
        details: numericDetails,
      });
      setHistory((current) => [entry, ...current]);
      const { data, error: streakError } = await client.rpc("record_streak_activity", { p_activity_type: activityType, p_timezone: userTimeZone() });
      const row = Array.isArray(data) ? data[0] as StreakRow | undefined : data as StreakRow | null;
      setMessage(streakError ? `${entry.activityName} kaydedildi; seri bilgisi daha sonra yenilenecek.` : `${entry.activityName} kaydedildi${row?.current_streak ? ` · ${row.current_streak} günlük seri` : ""}.`);
      window.dispatchEvent(new CustomEvent("fit-ai-activity-recorded", { detail: { streak: Number(row?.current_streak) || undefined } }));
    } catch {
      setMessage("Aktivite kaydedilemedi. Veritabanı bağlantısını kontrol edip yeniden dene.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="activity-logger" aria-labelledby="activity-logger-title">
    <div className="activity-logger-head"><div><div className="eyebrow">AKTİVİTE GÜNLÜĞÜ</div><h2 id="activity-logger-title">Bugün nasıl hareket ettin?</h2><p>Koşu, yürüyüş, bisiklet, yüzme veya program dışındaki sporlarını kaydet. Aynı gündeki ek kayıtlar seriyi yalnız bir kez etkiler.</p></div>{mode !== "closed" && <button type="button" className="activity-close" onClick={() => resetForm("closed")} aria-label="Aktivite ekleme alanını kapat">×</button>}</div>

    {mode === "closed" && <div className="activity-entry-options core-activities">{coreActivityCatalog.map((activity) => <button type="button" key={activity.key} onClick={() => selectActivity(activity.key)}><span className="activity-option-icon">{activity.icon}</span><div><strong>{activity.name} ekle</strong><small>Süre, mesafe ve enerji kaydı</small></div><b>→</b></button>)}<button type="button" onClick={() => resetForm("guide")}><span className="activity-option-icon sport">SP</span><div><strong>Diğer spor ekle</strong><small>15 spor arasından seçim yap</small></div><b>→</b></button></div>}

    {mode === "guide" && <div className="sport-guide"><div className="sport-guide-heading"><strong>SPOR SEÇİM KILAVUZU</strong><span>Yaptığın aktiviteye en yakın seçeneği aç.</span></div><div className="sport-guide-grid">{sportCatalog.map((sport) => <button type="button" key={sport.key} onClick={() => selectActivity(sport.key)}><span>{sport.icon}</span><div><strong>{sport.name}</strong><small>{sport.guide}</small></div><b>→</b></button>)}</div></div>}

    {mode === "form" && selectedActivity && <form className="activity-form" onSubmit={saveActivity}><button type="button" className="sport-guide-back" onClick={() => resetForm(coreActivityCatalog.some((activity) => activity.key === selectedActivity.key) ? "closed" : "guide")}>← Aktivite seçimine dön</button><div className="activity-form-title"><span>{selectedActivity.icon}</span><div><small>{selectedActivity.name.toLocaleUpperCase("tr-TR")} KAYDI</small><strong>{selectedActivity.guide}</strong></div></div><div className="activity-form-grid activity-core-fields"><label>AKTİVİTE TÜRÜ<input value={selectedActivity.name} readOnly /></label><label>SÜRE (DK)<input required min="1" max="1440" inputMode="numeric" type="number" value={duration} onChange={(event) => { setDuration(event.target.value); setCaloriesManual(false); }} /></label><label>MESAFE (KM)<input min="0" step="0.01" inputMode="decimal" type="number" value={distance} onChange={(event) => setDistance(event.target.value)} placeholder="İsteğe bağlı" /></label><label>TAHMİNİ KALORİ <small>{caloriesManual ? "MANUEL" : "OTOMATİK"}</small><input min="0" inputMode="numeric" type="number" value={calories} onChange={(event) => { setManualCalories(event.target.value); setCaloriesManual(true); }} placeholder="kcal" /></label><label>ADIM <small>İSTEĞE BAĞLI</small><input min="0" inputMode="numeric" type="number" value={steps} onChange={(event) => setSteps(event.target.value)} placeholder="0" /></label><label>YOĞUNLUK<select value={intensity} onChange={(event) => { setIntensity(event.target.value as typeof intensity); setCaloriesManual(false); }}>{activityIntensityOptions.map((option) => <option key={option}>{option}</option>)}</select></label>{selectedActivity.metrics.filter((metric) => metric.key !== "distanceKm").map((metric) => <label key={metric.key}>{metric.label.toLocaleUpperCase("tr-TR")} ({metric.unit})<input min="0" step={metric.step || "1"} inputMode="decimal" type="number" value={metrics[metric.key] || ""} onChange={(event) => setMetric(metric.key, event.target.value)} placeholder="İsteğe bağlı" /></label>)}</div><p className="activity-calorie-note">Kalori; profilindeki kilo, süre ve yoğunluğa göre MET yöntemiyle tahmin edilir. İstersen değeri değiştirebilirsin.</p><label className="activity-notes">KISA NOT<textarea maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={`${selectedActivity.name} kaydına eklemek istediğin not…`} /></label><button className="activity-save" disabled={saving} type="submit">{saving ? "Kaydediliyor…" : `${selectedActivity.name} kaydını ekle →`}</button></form>}

    {message && <p className="activity-logger-message" role="status">{message}</p>}

    <div className="activity-history"><div className="activity-history-head"><div><span>GÜNLÜK ÖZETLER</span><strong>Aktivite geçmişin</strong></div><small>Son {history.length} kayıt</small></div>{historyLoading ? <p className="activity-history-empty">Aktivitelerin yükleniyor…</p> : history.length === 0 ? <p className="activity-history-empty">Henüz aktivite kaydın yok. İlk kaydını yukarıdan ekleyebilirsin.</p> : <><div className="activity-daily-summaries">{dailySummaries.slice(0, 3).map((summary) => <article key={summary.localDate}><span>{formatActivityDate(summary.localDate)}</span><strong>{summary.durationMinutes} dk</strong><small>{summary.activityCount} aktivite · {summary.estimatedCalories} kcal{summary.distanceKm ? ` · ${summary.distanceKm.toFixed(1)} km` : ""}{summary.steps ? ` · ${summary.steps} adım` : ""}</small></article>)}</div><div className="activity-history-list">{history.slice(0, 8).map((entry) => <article key={entry.id}><span className="activity-history-icon">{activityByKey(entry.activityKey)?.icon || "SP"}</span><div><strong>{entry.activityName}</strong><small>{formatActivityDate(entry.localDate)} · {entry.durationMinutes} dk{entry.distanceKm ? ` · ${entry.distanceKm} km` : ""}</small>{entry.notes && <p>{entry.notes}</p>}</div><b>{entry.estimatedCalories ? `${entry.estimatedCalories} kcal` : entry.steps ? `${entry.steps} adım` : entry.intensity}</b></article>)}</div></>}</div>
  </section>;
}
