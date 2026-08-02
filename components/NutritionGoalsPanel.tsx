"use client";

import { AlertTriangle, RotateCcw, Save, SlidersHorizontal, Target } from "lucide-react";
import { useState } from "react";
import { nextMealSuggestion, nutritionGoalLabel, nutritionGoalWarning, weightTrendAdvice, type NutritionGoal, type NutritionGoalType, type NutritionTotals, type WeightTrend } from "@/lib/nutrition-goals";
import { useTranslations } from "@/lib/i18n/translate";
import { useLocale } from "@/lib/i18n/locale";

interface NutritionGoalsPanelProps {
  goal: NutritionGoal;
  recommendedGoals: Record<NutritionGoalType, NutritionGoal>;
  totals: NutritionTotals;
  trend: WeightTrend | null;
  trendProgress?: { count: number; daysLeft: number } | null;
  saving: boolean;
  saveMessage: string;
  onSave: (goal: NutritionGoal) => Promise<void>;
}

export function NutritionGoalsPanel({ goal, recommendedGoals, totals, trend, trendProgress, saving, saveMessage, onSave }: NutritionGoalsPanelProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "tr-TR";
  const [draft, setDraft] = useState(goal);
  const [editing, setEditing] = useState(false);

  const targetFields: Array<{ key: "calorieTarget" | "proteinGrams" | "carbsGrams" | "fatGrams"; label: string; unit: string; total: keyof NutritionTotals; className: string }> = [
    { key: "calorieTarget", label: t.nutritionGoals.fieldCalorie, unit: "kcal", total: "calories", className: "calories" },
    { key: "proteinGrams", label: t.nutritionGoals.fieldProtein, unit: "g", total: "protein", className: "protein" },
    { key: "carbsGrams", label: t.nutritionGoals.fieldCarbs, unit: "g", total: "carbs", className: "carbs" },
    { key: "fatGrams", label: t.nutritionGoals.fieldFat, unit: "g", total: "fat", className: "fat" },
  ];

  function selectGoal(goalType: NutritionGoalType) {
    setDraft(recommendedGoals[goalType]);
    setEditing(true);
  }

  function updateTarget(field: typeof targetFields[number]["key"], value: string) {
    const parsed = Math.max(0, Math.round(Number(value) || 0));
    setDraft((current) => ({ ...current, [field]: parsed, calorieAdjustment: field === "calorieTarget" ? parsed - current.tdee : current.calorieAdjustment, isManual: true }));
  }

  const warning = nutritionGoalWarning(draft, t);
  const adjustmentLabel = draft.calorieAdjustment === 0 ? t.nutritionGoals.maintenanceCalorie : `${draft.calorieAdjustment > 0 ? "+" : ""}${draft.calorieAdjustment} kcal ${draft.calorieAdjustment > 0 ? t.nutritionGoals.surplusSuffix : t.nutritionGoals.deficitSuffix}`;
  const trendLabel = trend
    ? t.nutritionGoals.weightPerWeek(`${trend.weeklyKg > 0 ? "+" : ""}${trend.weeklyKg.toLocaleString(dateLocale, { maximumFractionDigits: 2 })}`)
    : trendProgress ? t.nutritionGoals.trendProgressLabel(trendProgress.count) : t.nutritionGoals.measurementPending;
  // Trend yokken bile kullanıcı neyin eksik olduğunu görsün: kaç ölçüm var ve
  // ikinci ölçümün anlamlı olması için kaç gün kaldı.
  const trendBody = trend ? weightTrendAdvice(trend, draft.goalType, t)
    : trendProgress && trendProgress.count >= 1 && trendProgress.daysLeft > 0 ? t.nutritionGoals.trendWaitDays(trendProgress.daysLeft)
    : trendProgress && trendProgress.count >= 1 ? t.nutritionGoals.trendAddSecond
    : weightTrendAdvice(trend, draft.goalType, t);
  const goalHints: Record<NutritionGoalType, string> = { lose: t.nutritionGoals.loseHint, fatLoss: t.nutritionGoals.fatLossHint, gain: t.nutritionGoals.gainHint, maintain: t.nutritionGoals.maintainHint };

  return <section className="nutrition-goals" aria-labelledby="nutrition-goals-title">
    <div className="nutrition-goals-head">
      <div><div className="eyebrow">{t.nutritionGoals.eyebrow}</div><h2 id="nutrition-goals-title">{t.nutritionGoals.title}</h2><p>{t.nutritionGoals.body}</p></div>
      <button type="button" className="nutrition-edit" onClick={() => setEditing((current) => !current)} aria-expanded={editing}><SlidersHorizontal size={15} /> {editing ? t.nutritionGoals.closeEditing : t.nutritionGoals.editGoals}</button>
    </div>

    <div className="nutrition-goal-types" aria-label={t.nutritionGoals.goalTypeLabel}>
      {(["lose", "fatLoss", "maintain", "gain"] as NutritionGoalType[]).map((goalType) => <button type="button" key={goalType} aria-pressed={draft.goalType === goalType} className={draft.goalType === goalType ? "active" : ""} onClick={() => selectGoal(goalType)}><Target size={14} /><span>{nutritionGoalLabel(goalType, t)}</span><small>{goalHints[goalType]}</small></button>)}
    </div>

    <div className="nutrition-adjustment"><span>{nutritionGoalLabel(draft.goalType, t)}</span><strong>{adjustmentLabel}</strong><small>{t.nutritionGoals.tdeeToTarget(draft.tdee, draft.calorieTarget)}</small></div>

    {editing && <div className="nutrition-target-editor">
      <div className="nutrition-target-inputs">{targetFields.map((field) => <label key={field.key}>{field.label.toLocaleUpperCase(dateLocale)} ({field.unit})<input type="number" min="0" value={draft[field.key]} onChange={(event) => updateTarget(field.key, event.target.value)} /></label>)}</div>
      {warning && <div className="nutrition-warning" role="alert"><AlertTriangle size={17} /><p>{warning}</p></div>}
      <div className="nutrition-editor-actions"><button type="button" onClick={() => setDraft(recommendedGoals[draft.goalType])}><RotateCcw size={14} /> {t.nutritionGoals.resetToCalculated}</button><button type="button" className="nutrition-save" disabled={saving} onClick={() => void onSave(draft)}><Save size={14} /> {saving ? t.nutritionGoals.saving : t.nutritionGoals.saveGoals}</button></div>
      {saveMessage && <p className="nutrition-save-message" role="status">{saveMessage}</p>}
    </div>}

    <div className="nutrition-progress-grid">{targetFields.map((field) => {
      const current = Math.round(totals[field.total]);
      const target = Math.max(1, draft[field.key]);
      const percentage = Math.round(current / target * 100);
      return <article key={field.key} className={field.className}><div><span>{field.label.toLocaleUpperCase(dateLocale)}</span><strong>{t.nutritionGoals.kcalTargetOf(current, target, field.unit)}</strong></div><div className="nutrition-progress-track" role="progressbar" aria-label={t.nutritionGoals.goalLabel(field.label)} aria-valuenow={Math.min(100, percentage)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(100, percentage)}%` }} /></div><small>{percentage >= 100 ? t.nutritionGoals.percentOfTarget(percentage) : t.nutritionGoals.remaining(Math.max(0, target - current), field.unit)}</small></article>;
    })}</div>

    <div className="nutrition-guidance-grid">
      <article className="next-meal"><span>{t.nutritionGoals.nextMealEyebrow}</span><strong>{t.nutritionGoals.nextMealTitle}</strong><p>{nextMealSuggestion(totals, draft, t)}</p></article>
      <article className="weight-trend"><span>{t.nutritionGoals.weeklyTrendEyebrow}</span><strong>{trendLabel}</strong><p>{trendBody}</p></article>
    </div>

    <details className="nutrition-assumptions"><summary>{t.nutritionGoals.assumptionsSummary}</summary><div><p><strong>{t.nutritionGoals.bmrExplanation(draft.bmr)}</strong></p><p>{t.nutritionGoals.tdeeExplanation(draft.tdee, draft.activityFactor.toLocaleString(dateLocale), draft.workoutDays)}</p><p>{t.nutritionGoals.macroExplanation(draft.goalType === "maintain" ? "1,6" : "1,8")}</p><p>{t.nutritionGoals.estimateNote}</p></div></details>
    <div className="nutrition-medical-note"><AlertTriangle size={16} /><p><strong>{t.nutritionGoals.medicalNoteLabel}</strong> {t.nutritionGoals.medicalNote}</p></div>
  </section>;
}
