"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { forecastGoal, type WeightPoint } from "@/lib/goal-forecast";
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
  const [calorieAdjustment, setCalorieAdjustment] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      const [measurementResult, goalResult] = await Promise.all([
        supabase.from("body_measurements").select("measured_at, weight_kg").eq("user_id", userId).order("measured_at", { ascending: true }),
        supabase.from("nutrition_goals").select("calorie_adjustment").eq("user_id", userId).maybeSingle(),
      ]);
      if (cancelled) return;
      const points = (measurementResult.data || [])
        .map((row) => ({ dateIso: String(row.measured_at), weightKg: Number(row.weight_kg) }))
        .filter((point) => Number.isFinite(point.weightKg) && point.weightKg > 0);
      setMeasurements(points);
      const adjustment = Number(goalResult.data?.calorie_adjustment);
      setCalorieAdjustment(Number.isFinite(adjustment) ? adjustment : null);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Ölçümlerdeki en güncel kilo, profildeki değerden daha taze olabilir.
  const latestMeasured = measurements.length ? measurements[measurements.length - 1].weightKg : null;
  const effectiveWeightKg = latestMeasured ?? (Number.isFinite(Number(currentWeightKg)) ? Number(currentWeightKg) : null);
  const forecast = forecastGoal({ currentWeightKg: effectiveWeightKg, targetWeightKg, measurements, calorieAdjustmentPerDay: calorieAdjustment });

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
      <small className="goal-forecast-source">{forecast.source === "measured" ? t.goalForecast.sourceMeasured : t.goalForecast.sourcePlan}</small>
      {forecast.beyondHorizon && <p className="goal-forecast-note goal-forecast-warn">{t.goalForecast.beyondHorizon}</p>}
      {forecast.aggressive && <p className="goal-forecast-note goal-forecast-warn">{t.goalForecast.aggressive}</p>}
    </>}

    <p className="goal-forecast-disclaimer">{t.goalForecast.disclaimer}</p>
  </section>;
}
