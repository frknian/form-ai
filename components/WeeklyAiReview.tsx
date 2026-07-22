"use client";

import { useEffect, useRef, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { createClient } from "@/lib/supabase/client";
import { istanbulDateKey } from "@/lib/workout-calendar";
import { enforceWeeklySafety, hasEnoughWeeklyData, localWeeklyReview, validateWeeklyReview, validateWeeklySummary, weeklyGoalCategory, weeklyReviewWeekStart, weeklySummaryFingerprint, type WeeklyReview, type WeeklyReviewSource, type WeeklyReviewSummary } from "@/lib/weekly-review";

interface WeeklyAiReviewProps {
  userId?: string;
  goalText: string;
  referenceTime: number;
}

function difference(rows: Array<Record<string, unknown>>, field: string) {
  const values = rows.map((row) => row[field]).filter((value): value is number | string => value !== null && value !== undefined).map(Number).filter(Number.isFinite);
  return values.length >= 2 ? Number((values[values.length - 1] - values[0]).toFixed(2)) : null;
}

export function WeeklyAiReview({ userId, goalText, referenceTime }: WeeklyAiReviewProps) {
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [summary, setSummary] = useState<WeeklyReviewSummary | null>(null);
  const [source, setSource] = useState<WeeklyReviewSource | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">(userId ? "loading" : "empty");
  const requestedWeeks = useRef(new Set<string>());

  useEffect(() => {
    if (!userId) return;
    const requested = requestedWeeks.current;
    const weekStart = weeklyReviewWeekStart(referenceTime);
    const requestKey = `${userId}:${weekStart}`;
    if (requested.has(requestKey)) return;
    requested.add(requestKey);
    let cancelled = false;

    async function loadReview() {
      const supabase = createClient();
      if (!supabase) { if (!cancelled) setStatus("error"); return; }
      const { data: cached } = await supabase.from("weekly_ai_reviews").select("review, summary, source").eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
      if (cancelled) return;
      const cachedReview = validateWeeklyReview(cached?.review);
      const cachedSummary = validateWeeklySummary(cached?.summary);
      if (cachedReview && cachedSummary) {
        setReview(enforceWeeklySafety(cachedReview, cachedSummary));
        setSummary(cachedSummary);
        setSource(cached?.source === "ai" ? "ai" : "local");
        setStatus("ready");
        return;
      }

      const sevenDaysAgo = new Date(referenceTime - 7 * 24 * 60 * 60 * 1000);
      const measurementStart = istanbulDateKey(sevenDaysAgo);
      const [{ data: sessions, error: sessionError }, { data: foods, error: foodError }, { data: measurements, error: measurementError }] = await Promise.all([
        supabase.from("workout_sessions").select("completed_at, duration_seconds, completed_exercises, total_exercises, difficulty, fatigue, pain_areas").eq("user_id", userId).gte("completed_at", sevenDaysAgo.toISOString()).order("completed_at", { ascending: true }),
        supabase.from("food_entries").select("consumed_at, calories, protein_g").eq("user_id", userId).gte("consumed_at", sevenDaysAgo.toISOString()).order("consumed_at", { ascending: true }),
        supabase.from("body_measurements").select("measured_at, weight_kg, waist_cm").eq("user_id", userId).gte("measured_at", measurementStart).order("measured_at", { ascending: true }),
      ]);
      if (cancelled) return;
      if (sessionError || foodError || measurementError) { setStatus("error"); return; }

      const sessionRows = (sessions || []) as Array<Record<string, unknown>>;
      const foodRows = (foods || []) as Array<Record<string, unknown>>;
      const measurementRows = (measurements || []) as Array<Record<string, unknown>>;
      const completedExercises = sessionRows.reduce((total, row) => total + Number(row.completed_exercises || 0), 0);
      const totalExercises = sessionRows.reduce((total, row) => total + Number(row.total_exercises || 0), 0);
      const fatigueValues = sessionRows.map((row) => Number(row.fatigue)).filter((value) => Number.isFinite(value) && value > 0);
      const painAreas = [...new Set(sessionRows.flatMap((row) => Array.isArray(row.pain_areas) ? row.pain_areas.map(String) : []).filter((area) => area && area !== "Yok"))];
      const foodDays = new Set(foodRows.map((row) => istanbulDateKey(new Date(String(row.consumed_at)))));
      const nutritionDays = Math.max(1, foodDays.size);
      const rawSummary: WeeklyReviewSummary = {
        weekStart,
        goalCategory: weeklyGoalCategory(goalText),
        sessionCount: sessionRows.length,
        completionRate: totalExercises ? Math.round((completedExercises / totalExercises) * 100) : 0,
        totalMinutes: Math.round(sessionRows.reduce((total, row) => total + Number(row.duration_seconds || 0), 0) / 60),
        easySessions: sessionRows.filter((row) => row.difficulty === "Kolay").length,
        suitableSessions: sessionRows.filter((row) => row.difficulty === "Uygun").length,
        hardSessions: sessionRows.filter((row) => row.difficulty === "Zor").length,
        averageFatigue: fatigueValues.length ? Number((fatigueValues.reduce((total, value) => total + value, 0) / fatigueValues.length).toFixed(1)) : null,
        painAreas,
        nutritionEntryCount: foodRows.length,
        nutritionLoggedDays: foodDays.size,
        averageCalories: foodRows.length ? Math.round(foodRows.reduce((total, row) => total + Number(row.calories || 0), 0) / nutritionDays) : null,
        averageProteinGrams: foodRows.length ? Math.round(foodRows.reduce((total, row) => total + Number(row.protein_g || 0), 0) / nutritionDays) : null,
        weightChangeKg: difference(measurementRows, "weight_kg"),
        waistChangeCm: difference(measurementRows, "waist_cm"),
      };
      const safeSummary = validateWeeklySummary(rawSummary);
      if (!safeSummary || !hasEnoughWeeklyData(safeSummary)) { setSummary(safeSummary); setStatus("empty"); return; }
      setSummary(safeSummary);

      let resultReview: WeeklyReview;
      let resultSource: WeeklyReviewSource;
      let resultModel: string | null = null;
      try {
        const response = await fetch("/api/weekly-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary: safeSummary }) });
        const payload = await response.json() as { review?: unknown; source?: unknown; model?: unknown };
        const generated = validateWeeklyReview(payload.review);
        if (!response.ok || !generated) throw new Error("Değerlendirme üretilemedi");
        resultReview = enforceWeeklySafety(generated, safeSummary);
        resultSource = payload.source === "ai" ? "ai" : "local";
        resultModel = typeof payload.model === "string" ? payload.model : null;
      } catch {
        resultReview = enforceWeeklySafety(localWeeklyReview(safeSummary), safeSummary);
        resultSource = "local";
      }
      if (cancelled) return;
      setReview(resultReview);
      setSource(resultSource);
      setStatus("ready");
      await supabase.from("weekly_ai_reviews").upsert({ id: crypto.randomUUID(), user_id: userId, week_start: weekStart, summary: safeSummary, review: resultReview, source: resultSource, model: resultModel, input_fingerprint: weeklySummaryFingerprint(safeSummary), updated_at: new Date().toISOString() }, { onConflict: "user_id,week_start" });
    }

    void loadReview();
    return () => { cancelled = true; requested.delete(requestKey); };
  }, [goalText, referenceTime, userId]);

  return <section className="weekly-ai-review" aria-labelledby="weekly-review-title"><div className="weekly-review-top"><div><div className="eyebrow">HAFTALIK DEĞERLENDİRME</div><h2 id="weekly-review-title">AI koçun son 7 günü okudu</h2></div>{source && <span className={`weekly-review-source ${source}`}>{source === "ai" ? "✦ AI değerlendirmesi" : "Güvenli yerel değerlendirme"}</span>}</div>
    {status === "loading" && <div className="weekly-review-loading"><span>✦</span><div><strong>Haftalık verilerin özetleniyor</strong><p>Antrenman, beslenme ve ölçüm eğilimleri birlikte değerlendiriliyor.</p></div></div>}
    {status === "error" && <div className="weekly-review-empty"><span>!</span><div><strong>Değerlendirme şu anda hazırlanamadı</strong><p>Veri bağlantısı kurulduğunda bu haftanın özeti otomatik olarak burada görünecek.</p></div></div>}
    {status === "empty" && <div className="weekly-review-empty"><span>✦</span><div><strong>Biraz daha veriye ihtiyacımız var</strong><p>En az 2 antrenman; ya da 1 antrenmana ek olarak 2 günlük beslenme kaydı veya iki vücut ölçümü eklediğinde haftalık değerlendirme hazırlanacak. Yetersiz veride AI çağrısı yapılmaz.</p></div></div>}
    {status === "ready" && review && summary && <><div className="weekly-review-metrics"><div><span>ANTRENMAN</span><strong>{summary.sessionCount}</strong><small>son 7 gün</small></div><div><span>TAMAMLAMA</span><strong>%{summary.completionRate}</strong><small>hareket oranı</small></div><div><span>TOPLAM SÜRE</span><strong>{summary.totalMinutes} dk</strong><small>aktif kayıt</small></div><div><span>YORGUNLUK</span><strong>{summary.averageFatigue === null ? "—" : `${summary.averageFatigue}/5`}</strong><small>{summary.painAreas.length ? `${summary.painAreas.length} ağrı alanı` : "ağrı sinyali yok"}</small></div></div><div className="weekly-review-headline"><span>✦</span><div><h3>{review.headline}</h3><MessageResponse>{review.summary}</MessageResponse></div></div><div className="weekly-review-columns"><article className="positive"><span>OLUMLU GELİŞMELER</span><ul>{review.positives.map((item) => <li key={item}><i>✓</i><MessageResponse>{item}</MessageResponse></li>)}</ul></article><article className="caution"><span>DİKKAT EDİLMESİ GEREKENLER</span><ul>{review.cautions.map((item) => <li key={item}><i>!</i><MessageResponse>{item}</MessageResponse></li>)}</ul></article></div><div className="weekly-review-actions"><span>GELECEK HAFTA İÇİN</span><ol>{review.recommendations.map((item, index) => <li key={item}><b>{index + 1}</b><MessageResponse>{item}</MessageResponse></li>)}</ol></div><div className="weekly-review-safety"><strong>Güvenlik notu</strong><MessageResponse>{review.safetyNote}</MessageResponse></div></>}
  </section>;
}
