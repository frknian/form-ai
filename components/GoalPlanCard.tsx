"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authorizedFetch } from "@/lib/api-client";
import {
  GOAL_INTENSITIES,
  SESSION_MINUTE_OPTIONS,
  WEEKLY_DAY_OPTIONS,
  normalizeAnswers,
  planGoal,
  projectWeightSeries,
  seriesToPath,
  validateGoalAnalysis,
  type GoalAnalysis,
  type GoalIntensity,
  type GoalPlanAnswers,
} from "@/lib/goal-plan";
import { measuredWeeklyRate, type WeightPoint } from "@/lib/goal-forecast";
import { WEIGHT_RANGE, clampToRange, rangePercent, readMeasure } from "@/lib/body-metrics";
import { setStoredGoalPlan, useStoredGoalPlan } from "@/lib/preferences";
import { useWeightUnit } from "@/lib/preferences";
import { formatWeight } from "@/lib/units";
import { useTranslations } from "@/lib/i18n/translate";
import { useLocale } from "@/lib/i18n/locale";

const STEP_COUNT = 4;

function intensityCopy(t: ReturnType<typeof useTranslations>, intensity: GoalIntensity) {
  if (intensity === "easy") return { label: t.goalPlan.intensityEasy, hint: t.goalPlan.intensityEasyHint };
  if (intensity === "hard") return { label: t.goalPlan.intensityHard, hint: t.goalPlan.intensityHardHint };
  return { label: t.goalPlan.intensitySteady, hint: t.goalPlan.intensitySteadyHint };
}

/**
 * Hedefe giden takvimi kullanıcıya SORARAK kurar.
 *
 * Eski kart yalnız geçmiş kayıtlardan geriye dönük tahmin yapıyordu; kayıt
 * yoksa "yeterli veri yok" deyip duruyordu. Burada kullanıcı hedefini ve
 * çalışma temposunu söylüyor, uygulama takvimi hesaplıyor, grafik çiziyor ve
 * yapay zekâ bu sayıları yorumluyor.
 */
/**
 * `profileBmr`: panelde boy/kilo/doğum tarihinden zaten hesaplanan BMR.
 * Kart yalnız nutrition_goals tablosuna bakıyordu; beslenme sekmesini hiç
 * açmamış kullanıcıda o satır olmadığı için profil eksiksizken bile
 * "günlük kalori hedefi için boy, kilo ve doğum tarihi gerekiyor" diyordu.
 */
export function GoalPlanCard({ userId, currentWeightKg, profileBmr }: { userId?: string; currentWeightKg?: number | null; profileBmr?: number | null }) {
  const t = useTranslations();
  const locale = useLocale();
  const unit = useWeightUnit();
  const savedRaw = useStoredGoalPlan();
  const saved = useMemo(() => normalizeAnswers(savedRaw), [savedRaw]);

  const [storedBmr, setStoredBmr] = useState<number | null>(null);
  const [measurements, setMeasurements] = useState<WeightPoint[]>([]);
  const [step, setStep] = useState<number | null>(null);
  const [draft, setDraft] = useState<GoalPlanAnswers | null>(null);
  const [analysis, setAnalysis] = useState<GoalAnalysis | null>(null);
  const [analysisSource, setAnalysisSource] = useState<"ai" | "local" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Aynı plan için analizi tekrar tekrar istememek adına son istenen imza.
  const requestedSignature = useRef("");

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      const [goalResult, measurementResult] = await Promise.all([
        supabase.from("nutrition_goals").select("bmr").eq("user_id", userId).maybeSingle(),
        supabase.from("body_measurements").select("weight_kg, measured_at").eq("user_id", userId).not("weight_kg", "is", null).order("measured_at", { ascending: true }),
      ]);
      if (cancelled) return;
      const bmrValue = Number(goalResult.data?.bmr);
      setStoredBmr(Number.isFinite(bmrValue) && bmrValue > 0 ? bmrValue : null);
      setMeasurements((measurementResult.data || [])
        .map((row) => ({ dateIso: String(row.measured_at), weightKg: Number(row.weight_kg) }))
        .filter((point) => Number.isFinite(point.weightKg) && point.weightKg > 0));
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Kaydedilmiş hedef tablosu önceliklidir; yoksa profilden hesaplanana düşer.
  const bmr = storedBmr ?? (Number.isFinite(Number(profileBmr)) && Number(profileBmr) > 0 ? Number(profileBmr) : null);
  // En taze kilo: tartı kaydı profildeki değerden güncel olabilir.
  const latestWeight = measurements.length ? measurements[measurements.length - 1].weightKg : null;
  const effectiveWeight = latestWeight ?? (Number.isFinite(Number(currentWeightKg)) && Number(currentWeightKg) > 0 ? Number(currentWeightKg) : null);
  // Planın yanında GERÇEKLEŞEN hız: kullanıcı plandan sapıyorsa görebilsin.
  const measuredRate = useMemo(() => measuredWeeklyRate(measurements), [measurements]);
  const plan = saved && effectiveWeight ? planGoal(saved, { currentWeightKg: effectiveWeight, bmr }) : null;

  // Plan değiştiğinde analizi tazele.
  useEffect(() => {
    if (!saved || !effectiveWeight || !plan || plan.status !== "ready") return;
    const signature = JSON.stringify([saved, Math.round(effectiveWeight * 10), bmr]);
    if (requestedSignature.current === signature) return;
    requestedSignature.current = signature;
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await authorizedFetch("/api/goal-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: saved, currentWeightKg: effectiveWeight, bmr, locale }),
          // Zaman aşımı olmadan istek asılı kalırsa kart sonsuza dek
          // "analiz ediliyor" yazıp sayıları hiç göstermiyordu.
          signal: AbortSignal.timeout(25_000),
        });
        const data = await response.json() as { analysis?: unknown; source?: string };
        if (cancelled) return;
        const validated = validateGoalAnalysis(data.analysis);
        if (!response.ok || !validated) { setError(t.goalPlan.error); setAnalysis(null); return; }
        setAnalysis(validated);
        setAnalysisSource(data.source === "ai" ? "ai" : "local");
      } catch {
        if (!cancelled) { setError(t.goalPlan.error); setAnalysis(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [saved, effectiveWeight, bmr, locale, plan, t.goalPlan.error]);

  function startWizard() {
    setDraft(saved ?? {
      // Varsayılan hedef, mevcut kilonun biraz altı: kullanıcı sıfırdan
      // kaydırmak yerine makul bir noktadan başlasın.
      targetWeightKg: effectiveWeight ? Math.max(WEIGHT_RANGE.min, Math.round(effectiveWeight - 5)) : 70,
      weeklyDays: 3,
      sessionMinutes: 45,
      intensity: "steady",
    });
    setStep(1);
  }

  function commit(next: GoalPlanAnswers) {
    setStoredGoalPlan(next);
    setStep(null);
    setDraft(null);
  }

  if (!effectiveWeight) {
    return <section className="goal-plan">
      <div className="section-title"><div className="eyebrow">{t.goalPlan.eyebrow}</div></div>
      <h2>{t.goalPlan.title}</h2>
      <p className="goal-plan-note">{t.goalPlan.needsWeight}</p>
    </section>;
  }

  // --- Soru sihirbazı ---
  if (step !== null && draft) {
    const setDraftValue = (patch: Partial<GoalPlanAnswers>) => setDraft((current) => current ? { ...current, ...patch } : current);
    const targetPercent = rangePercent(draft.targetWeightKg, WEIGHT_RANGE);
    return <section className="goal-plan">
      <div className="section-title"><div className="eyebrow">{t.goalPlan.eyebrow}</div><span className="goal-plan-step">{t.goalPlan.stepCounter(step, STEP_COUNT)}</span></div>
      <div className="question-progress-bar" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={STEP_COUNT}><i style={{ width: `${(step / STEP_COUNT) * 100}%` }} /></div>

      {step === 1 && <div className="goal-plan-question">
        <h2>{t.goalPlan.questionTarget}</h2>
        <div className="measure-readout">
          <button type="button" className="measure-step" aria-label={t.onboarding.decreaseLabel(t.onboarding.weightShort)} onClick={() => setDraftValue({ targetWeightKg: clampToRange(draft.targetWeightKg - 1, WEIGHT_RANGE) })}>−</button>
          <strong><b>{draft.targetWeightKg}</b><small>kg</small></strong>
          <button type="button" className="measure-step" aria-label={t.onboarding.increaseLabel(t.onboarding.weightShort)} onClick={() => setDraftValue({ targetWeightKg: clampToRange(draft.targetWeightKg + 1, WEIGHT_RANGE) })}>+</button>
        </div>
        <div className="measure-slider" style={{ ["--fill" as string]: `${targetPercent}%` }}>
          <input type="range" min={WEIGHT_RANGE.min} max={WEIGHT_RANGE.max} step={1} value={draft.targetWeightKg} aria-label={t.goalPlan.questionTarget}
            onChange={(event) => setDraftValue({ targetWeightKg: readMeasure(event.target.value, WEIGHT_RANGE, draft.targetWeightKg) })} />
        </div>
        <div className="measure-scale"><span>{WEIGHT_RANGE.min}</span><span>{WEIGHT_RANGE.max}</span></div>
      </div>}

      {step === 2 && <div className="goal-plan-question">
        <h2>{t.goalPlan.questionDays}</h2>
        <div className="equipment-list">{WEEKLY_DAY_OPTIONS.map((days) => <button type="button" key={days} aria-pressed={draft.weeklyDays === days} className={draft.weeklyDays === days ? "equipment selected" : "equipment"} onClick={() => setDraftValue({ weeklyDays: days })}>{t.goalPlan.dayUnit(days)}</button>)}</div>
      </div>}

      {step === 3 && <div className="goal-plan-question">
        <h2>{t.goalPlan.questionMinutes}</h2>
        <div className="equipment-list">{SESSION_MINUTE_OPTIONS.map((minutes) => <button type="button" key={minutes} aria-pressed={draft.sessionMinutes === minutes} className={draft.sessionMinutes === minutes ? "equipment selected" : "equipment"} onClick={() => setDraftValue({ sessionMinutes: minutes })}>{t.goalPlan.minuteUnit(minutes)}</button>)}</div>
      </div>}

      {step === 4 && <div className="goal-plan-question">
        <h2>{t.goalPlan.questionIntensity}</h2>
        <div className="option-cards option-cards-3">{GOAL_INTENSITIES.map((intensity) => {
          const copy = intensityCopy(t, intensity);
          return <button type="button" key={intensity} aria-pressed={draft.intensity === intensity} className={draft.intensity === intensity ? "option-card selected" : "option-card"} onClick={() => setDraftValue({ intensity })}>
            <span>{copy.label}</span><small>{copy.hint}</small>
          </button>;
        })}</div>
      </div>}

      <div className="action-row">
        <button type="button" className="back-btn" onClick={() => step === 1 ? (setStep(null), setDraft(null)) : setStep(step - 1)}>{t.goalPlan.back}</button>
        {step < STEP_COUNT
          ? <button type="button" className="primary-btn" onClick={() => setStep(step + 1)}>{t.goalPlan.next} <span>→</span></button>
          : <button type="button" className="primary-btn" onClick={() => commit(draft)}>{t.goalPlan.analyze} <span>→</span></button>}
      </div>
    </section>;
  }

  // --- Plan yokken davet ---
  if (!saved || !plan) {
    return <section className="goal-plan">
      <div className="section-title"><div className="eyebrow">{t.goalPlan.eyebrow}</div></div>
      <h2>{t.goalPlan.title}</h2>
      <p className="goal-plan-note">{t.goalPlan.intro}</p>
      <button type="button" className="primary-btn" onClick={startWizard}>{t.goalPlan.start} <span>→</span></button>
    </section>;
  }

  if (plan.status !== "ready") {
    return <section className="goal-plan">
      <div className="section-title"><div className="eyebrow">{t.goalPlan.eyebrow}</div><button type="button" className="goal-plan-edit" onClick={startWizard}>{t.goalPlan.edit}</button></div>
      <h2>{t.goalPlan.title}</h2>
      <p className="goal-plan-note goal-plan-done">{plan.status === "reached" ? t.goalPlan.reached : t.goalPlan.needsWeight}</p>
    </section>;
  }

  const series = projectWeightSeries(effectiveWeight, plan.weeklyRateKg, saved.targetWeightKg, plan.weeks);
  const path = seriesToPath(series, 100, 46);
  const etaText = new Date(plan.etaIso).toLocaleDateString(locale === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const warningText: Record<string, string> = {
    clampedToSafeRate: t.goalPlan.warnClamped,
    intakeBelowBmr: t.goalPlan.warnBelowBmr,
    beyondHorizon: t.goalPlan.warnBeyondHorizon,
    noBmr: t.goalPlan.warnNoBmr,
  };

  return <section className="goal-plan">
    <div className="section-title"><div className="eyebrow">{t.goalPlan.eyebrow}</div><button type="button" className="goal-plan-edit" onClick={startWizard}>{t.goalPlan.edit}</button></div>
    <h2>{analysis?.headline || t.goalPlan.title}</h2>

    <div className="goal-plan-stats">
      <div><span>{t.goalPlan.weeksValue(plan.weeks)}</span><strong>{etaText}</strong><small>{t.goalPlan.etaLabel}</small></div>
      <div><span>{t.goalPlan.remainingLabel(formatWeight(plan.remainingKg, unit, { withUnit: true }))}</span><strong>{plan.losing ? "−" : "+"}{formatWeight(Math.abs(plan.weeklyRateKg), unit, { decimals: 2 })}</strong><small>{t.goalPlan.rateLabel}</small></div>
      {plan.dailyIntakeKcal !== null && <div><span>{t.goalPlan.intakeLabel}</span><strong>{plan.dailyIntakeKcal} <small>kcal</small></strong><small>{t.goalPlan.trainingLabel(plan.dailyTrainingBurnKcal)}</small></div>}
    </div>

    {/* Grafik: bugünden hedefe uzanan tahmini eğri. Hedef çizgisi kesikli. */}
    <figure className="goal-plan-chart">
      <svg viewBox="0 0 100 46" preserveAspectRatio="none" role="img" aria-label={t.goalPlan.chartLabel}>
        <defs>
          <linearGradient id="goal-plan-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.34" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path className="goal-plan-chart-area" d={`${path} L100 46 L0 46 Z`} />
        {/* Hedef çizgisi: eğrinin nerede düzleştiğini gösterir. */}
        <line className="goal-plan-chart-target" x1="0" y1="45" x2="100" y2="45" />
        <path className="goal-plan-chart-line" d={path} />
      </svg>
      <figcaption>
        <span>{t.goalPlan.chartStart} · {formatWeight(effectiveWeight, unit, { withUnit: true })}</span>
        <span>{t.goalPlan.chartTarget} · {formatWeight(saved.targetWeightKg, unit, { withUnit: true })}</span>
      </figcaption>
    </figure>

    {/* Plan bir taahhüt, ölçüm ise gerçek. İkisini yan yana göstermek
        kullanıcının sapmayı erken fark etmesini sağlar. */}
    {measuredRate !== null && <p className="goal-plan-measured">{t.goalPlan.measuredCheck(`${measuredRate < 0 ? "−" : "+"}${formatWeight(Math.abs(measuredRate), unit, { decimals: 2, withUnit: true })}`)}</p>}

    {loading && <p className="goal-plan-note">{t.goalPlan.analyzing}</p>}
    {error && <p className="goal-plan-note goal-plan-warn">{error}</p>}

    {analysis && <div className="goal-plan-analysis">
      <p>{analysis.assessment}</p>
      <ul>{analysis.steps.map((item) => <li key={item}>{item}</li>)}</ul>
      <small className="goal-plan-source">{analysisSource === "ai" ? t.goalPlan.aiSourceAi : t.goalPlan.aiSourceLocal}</small>
      <small className="goal-plan-safety">{analysis.safetyNote}</small>
    </div>}

    {plan.warnings.map((warning) => <p className="goal-plan-note goal-plan-warn" key={warning}>{warningText[warning]}</p>)}
    <p className="goal-plan-disclaimer">{t.goalPlan.disclaimer}</p>
  </section>;
}
