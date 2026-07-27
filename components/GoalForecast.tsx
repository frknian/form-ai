"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { forecastGoal, type CalorieEntry, type WeightPoint } from "@/lib/goal-forecast";
import { setStoredTargetWeightKg, useTargetWeightKg, useWeightUnit } from "@/lib/preferences";
import { formatWeight, kgToInputValue, parseWeightInputToKg, weightUnitLabel } from "@/lib/units";
import { useTranslations } from "@/lib/i18n/translate";
import { useLocale } from "@/lib/i18n/locale";

/**
 * Ana sayfadaki hedef tahmini kartı. Hız, önce kullanıcının kendi kilo
 * ölçümlerinden, ölçüm yetersizse beslenme hedefindeki kalori farkından
 * türetilir (bkz. lib/goal-forecast.ts). Veri yetersizse tarih uydurulmaz.
 */
export function GoalForecast({ userId, currentWeightKg }: { userId?: string; currentWeightKg?: number | null }) {
  const t = useTranslations();
  const locale = useLocale();
  const unit = useWeightUnit();
  const targetWeightKg = useTargetWeightKg();
  const [measurements, setMeasurements] = useState<WeightPoint[]>([]);
  const [energy, setEnergy] = useState<{ bmr: number | null; tdee: number | null; calorieTarget: number | null }>({ bmr: null, tdee: null, calorieTarget: null });
  const [activityEntries, setActivityEntries] = useState<CalorieEntry[]>([]);
  const [intakeEntries, setIntakeEntries] = useState<CalorieEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    // Enerji penceresi 28 gün; biraz pay bırakıp 40 günü çekiyoruz.
    const since = new Date(Date.now() - 40 * 86_400_000).toISOString();
    void (async () => {
      const [measurementResult, goalResult, workoutResult, sportResult, foodResult] = await Promise.all([
        supabase.from("body_measurements").select("measured_at, weight_kg").eq("user_id", userId).order("measured_at", { ascending: true }),
        supabase.from("nutrition_goals").select("bmr, tdee, calorie_target").eq("user_id", userId).maybeSingle(),
        supabase.from("workout_sessions").select("completed_at, calories").eq("user_id", userId).gte("completed_at", since),
        supabase.from("sport_activity_entries").select("occurred_at, estimated_calories").eq("user_id", userId).gte("occurred_at", since),
        supabase.from("food_entries").select("consumed_at, calories").eq("user_id", userId).gte("consumed_at", since),
      ]);
      if (cancelled) return;

      setMeasurements((measurementResult.data || [])
        .map((row) => ({ dateIso: String(row.measured_at), weightKg: Number(row.weight_kg) }))
        .filter((point) => Number.isFinite(point.weightKg) && point.weightKg > 0));

      const numberOrNull = (value: unknown) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null);
      setEnergy({
        bmr: numberOrNull(goalResult.data?.bmr),
        tdee: numberOrNull(goalResult.data?.tdee),
        calorieTarget: numberOrNull(goalResult.data?.calorie_target),
      });

      // Antrenman ve spor aktiviteleri birlikte "gün içindeki hareket" harcamasıdır.
      const toEntries = (rows: Record<string, unknown>[] | null, dateKey: string, calorieKey: string) => (rows || [])
        .map((row) => ({ dateIso: String(row[dateKey]), calories: Number(row[calorieKey]) }))
        .filter((entry) => Number.isFinite(entry.calories) && entry.calories > 0);
      setActivityEntries([
        ...toEntries(workoutResult.data, "completed_at", "calories"),
        ...toEntries(sportResult.data, "occurred_at", "estimated_calories"),
      ]);
      setIntakeEntries(toEntries(foodResult.data, "consumed_at", "calories"));
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Ölçümlerdeki en güncel kilo, profildeki değerden daha taze olabilir.
  const latestMeasured = measurements.length ? measurements[measurements.length - 1].weightKg : null;
  const effectiveWeightKg = latestMeasured ?? (Number.isFinite(Number(currentWeightKg)) ? Number(currentWeightKg) : null);
  const forecast = forecastGoal({
    currentWeightKg: effectiveWeightKg,
    targetWeightKg,
    measurements,
    activityEntries,
    intakeEntries,
    ...energy,
  });

  function saveTarget() {
    const parsed = parseWeightInputToKg(draft, unit);
    setStoredTargetWeightKg(parsed);
    setEditing(false);
  }

  function startEditing() {
    setDraft(kgToInputValue(targetWeightKg, unit));
    setEditing(true);
  }

  const showForm = editing || forecast.status === "needs-target";
  const rateText = "weeklyRateKg" in forecast
    ? formatWeight(Math.abs(forecast.weeklyRateKg), unit, { decimals: 2 })
    : "";

  return <section className="goal-forecast">
    <div className="section-title"><div><div className="eyebrow">{t.goalForecast.eyebrow}</div><h2>{t.goalForecast.title}</h2></div>
      {targetWeightKg !== null && !editing && <button type="button" className="goal-forecast-edit" onClick={startEditing}>{formatWeight(targetWeightKg, unit, { withUnit: true })}</button>}
    </div>

    {showForm && <div className="goal-forecast-form">
      <label htmlFor="goal-target-weight">{t.goalForecast.targetLabel(weightUnitLabel(unit))}</label>
      <div>
        <input
          id="goal-target-weight"
          type="number"
          inputMode="decimal"
          min="1"
          step="0.1"
          value={draft}
          placeholder={t.goalForecast.targetPlaceholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); saveTarget(); } }}
        />
        <button type="button" onClick={saveTarget}>{t.goalForecast.save}</button>
        {targetWeightKg !== null && <button type="button" className="goal-forecast-clear" onClick={() => { setStoredTargetWeightKg(null); setDraft(""); setEditing(false); }}>{t.goalForecast.clear}</button>}
      </div>
    </div>}

    {forecast.status === "needs-weight" && <p className="goal-forecast-note">{t.goalForecast.needsWeight}</p>}
    {forecast.status === "needs-target" && !editing && <p className="goal-forecast-note">{t.goalForecast.needsTarget}</p>}
    {forecast.status === "reached" && <p className="goal-forecast-note goal-forecast-done">{t.goalForecast.reached}</p>}
    {forecast.status === "no-rate" && <p className="goal-forecast-note">{t.goalForecast.noRate}</p>}
    {forecast.status === "wrong-direction" && <p className="goal-forecast-note goal-forecast-warn">{t.goalForecast.wrongDirection(rateText)}</p>}

    {forecast.status === "ready" && <>
      <div className="goal-forecast-grid">
        <div>
          <span>{t.goalForecast.weeksLeft(forecast.weeks)}</span>
          <strong>{new Date(forecast.etaIso).toLocaleDateString(locale === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "long", year: "numeric" })}</strong>
          <small>{t.goalForecast.etaLabel}</small>
        </div>
        <div>
          <span>{t.goalForecast.remaining(formatWeight(forecast.remainingKg, unit, { withUnit: true }))}</span>
          <strong>{forecast.losing ? "−" : "+"}{rateText}</strong>
          <small>{t.goalForecast.rateLabel}</small>
        </div>
      </div>

      {/* Tahminin nereden çıktığı: günlük yakım, alım ve aradaki fark. */}
      {forecast.energy && <div className="goal-forecast-energy">
        <strong>{forecast.energy.balanceKcal < 0
          ? t.goalForecast.balanceDeficit(Math.round(Math.abs(forecast.energy.balanceKcal)))
          : t.goalForecast.balanceSurplus(Math.round(forecast.energy.balanceKcal))}</strong>
        <div className="goal-forecast-energy-row">
          <span>{t.goalForecast.burnLabel(Math.round(forecast.energy.expenditureKcal))}</span>
          <span>{t.goalForecast.intakeLabel(Math.round(forecast.energy.intakeKcal))}</span>
        </div>
        {forecast.energy.expenditureBasis === "logged" && forecast.energy.activityKcal >= 1 && <small>{t.goalForecast.activityNote(Math.round(forecast.energy.activityKcal))}</small>}
        <small>{forecast.energy.intakeBasis === "logged" ? t.goalForecast.basisLoggedIntake : t.goalForecast.basisTargetIntake}</small>
      </div>}

      <small className="goal-forecast-source">{forecast.source === "measured" ? t.goalForecast.sourceMeasured : t.goalForecast.sourceEnergy}</small>
      {/* Plan ile gerçeğin ayrıştığını görebilmesi için ölçüm hızı da gösterilir. */}
      {forecast.source === "energy" && forecast.measuredWeeklyRateKg !== null && <small className="goal-forecast-source">{t.goalForecast.measuredCheck(`${forecast.measuredWeeklyRateKg < 0 ? "−" : "+"}${formatWeight(Math.abs(forecast.measuredWeeklyRateKg), unit, { decimals: 2, withUnit: true })}`)}</small>}
      {forecast.beyondHorizon && <p className="goal-forecast-note goal-forecast-warn">{t.goalForecast.beyondHorizon}</p>}
      {forecast.aggressive && <p className="goal-forecast-note goal-forecast-warn">{t.goalForecast.aggressive}</p>}
    </>}

    <p className="goal-forecast-disclaimer">{t.goalForecast.disclaimer}</p>
  </section>;
}
