"use client";

import { AlertTriangle, RotateCcw, Save, SlidersHorizontal, Target } from "lucide-react";
import { useState } from "react";
import { nextMealSuggestion, nutritionGoalLabel, nutritionGoalWarning, weightTrendAdvice, type NutritionGoal, type NutritionGoalType, type NutritionTotals, type WeightTrend } from "@/lib/nutrition-goals";

interface NutritionGoalsPanelProps {
  goal: NutritionGoal;
  recommendedGoals: Record<NutritionGoalType, NutritionGoal>;
  totals: NutritionTotals;
  trend: WeightTrend | null;
  saving: boolean;
  saveMessage: string;
  onSave: (goal: NutritionGoal) => Promise<void>;
}

const targetFields: Array<{ key: "calorieTarget" | "proteinGrams" | "carbsGrams" | "fatGrams"; label: string; unit: string; total: keyof NutritionTotals; className: string }> = [
  { key: "calorieTarget", label: "Kalori", unit: "kcal", total: "calories", className: "calories" },
  { key: "proteinGrams", label: "Protein", unit: "g", total: "protein", className: "protein" },
  { key: "carbsGrams", label: "Karbonhidrat", unit: "g", total: "carbs", className: "carbs" },
  { key: "fatGrams", label: "Yağ", unit: "g", total: "fat", className: "fat" },
];

export function NutritionGoalsPanel({ goal, recommendedGoals, totals, trend, saving, saveMessage, onSave }: NutritionGoalsPanelProps) {
  const [draft, setDraft] = useState(goal);
  const [editing, setEditing] = useState(false);

  function selectGoal(goalType: NutritionGoalType) {
    setDraft(recommendedGoals[goalType]);
    setEditing(true);
  }

  function updateTarget(field: typeof targetFields[number]["key"], value: string) {
    const parsed = Math.max(0, Math.round(Number(value) || 0));
    setDraft((current) => ({ ...current, [field]: parsed, calorieAdjustment: field === "calorieTarget" ? parsed - current.tdee : current.calorieAdjustment, isManual: true }));
  }

  const warning = nutritionGoalWarning(draft);
  const adjustmentLabel = draft.calorieAdjustment === 0 ? "Bakım kalorisi" : `${draft.calorieAdjustment > 0 ? "+" : ""}${draft.calorieAdjustment} kcal ${draft.calorieAdjustment > 0 ? "fazla" : "açık"}`;
  const trendLabel = trend ? `${trend.weeklyKg > 0 ? "+" : ""}${trend.weeklyKg.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} kg/hafta` : "Ölçüm bekleniyor";

  return <section className="nutrition-goals" aria-labelledby="nutrition-goals-title">
    <div className="nutrition-goals-head">
      <div><div className="eyebrow">KİŞİYE ÖZEL HEDEFLER</div><h2 id="nutrition-goals-title">Enerji ve makro planın</h2><p>BMR, günlük hareket düzeyi, kilon ve haftalık antrenman sıklığın birlikte kullanıldı.</p></div>
      <button type="button" className="nutrition-edit" onClick={() => setEditing((current) => !current)} aria-expanded={editing}><SlidersHorizontal size={15} /> {editing ? "Düzenlemeyi kapat" : "Hedefleri düzenle"}</button>
    </div>

    <div className="nutrition-goal-types" aria-label="Beslenme hedefi seçimi">
      {(["lose", "maintain", "gain"] as NutritionGoalType[]).map((goalType) => <button type="button" key={goalType} aria-pressed={draft.goalType === goalType} className={draft.goalType === goalType ? "active" : ""} onClick={() => selectGoal(goalType)}><Target size={14} /><span>{nutritionGoalLabel(goalType)}</span><small>{goalType === "lose" ? "Makul kalori açığı" : goalType === "gain" ? "Kontrollü kalori fazlası" : "Dengeli bakım hedefi"}</small></button>)}
    </div>

    <div className="nutrition-adjustment"><span>{nutritionGoalLabel(draft.goalType)}</span><strong>{adjustmentLabel}</strong><small>TDEE {draft.tdee} kcal → günlük hedef {draft.calorieTarget} kcal</small></div>

    {editing && <div className="nutrition-target-editor">
      <div className="nutrition-target-inputs">{targetFields.map((field) => <label key={field.key}>{field.label.toLocaleUpperCase("tr-TR")} ({field.unit})<input type="number" min="0" value={draft[field.key]} onChange={(event) => updateTarget(field.key, event.target.value)} /></label>)}</div>
      {warning && <div className="nutrition-warning" role="alert"><AlertTriangle size={17} /><p>{warning}</p></div>}
      <div className="nutrition-editor-actions"><button type="button" onClick={() => setDraft(recommendedGoals[draft.goalType])}><RotateCcw size={14} /> Hesaplanan hedefe dön</button><button type="button" className="nutrition-save" disabled={saving} onClick={() => void onSave(draft)}><Save size={14} /> {saving ? "Kaydediliyor…" : "Hedefleri kaydet"}</button></div>
      {saveMessage && <p className="nutrition-save-message" role="status">{saveMessage}</p>}
    </div>}

    <div className="nutrition-progress-grid">{targetFields.map((field) => {
      const current = Math.round(totals[field.total]);
      const target = Math.max(1, draft[field.key]);
      const percentage = Math.round(current / target * 100);
      return <article key={field.key} className={field.className}><div><span>{field.label.toLocaleUpperCase("tr-TR")}</span><strong>{current}<small> / {target} {field.unit}</small></strong></div><div className="nutrition-progress-track" role="progressbar" aria-label={`${field.label} hedefi`} aria-valuenow={Math.min(100, percentage)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(100, percentage)}%` }} /></div><small>{percentage >= 100 ? `Hedefin %${percentage}'i` : `${Math.max(0, target - current)} ${field.unit} kaldı`}</small></article>;
    })}</div>

    <div className="nutrition-guidance-grid">
      <article className="next-meal"><span>SONRAKİ ÖĞÜN ODAĞI</span><strong>Bugünkü kayıtlara göre</strong><p>{nextMealSuggestion(totals, draft)}</p></article>
      <article className="weight-trend"><span>HAFTALIK KİLO EĞİLİMİ</span><strong>{trendLabel}</strong><p>{weightTrendAdvice(trend, draft.goalType)}</p></article>
    </div>

    <details className="nutrition-assumptions"><summary>Bu hedef nasıl hesaplandı?</summary><div><p><strong>BMR:</strong> {draft.bmr} kcal. Mifflin–St Jeor denklemiyle yaş, boy, kilo ve cinsiyet bilginden tahmin edildi.</p><p><strong>TDEE:</strong> {draft.tdee} kcal. BMR, {draft.activityFactor.toLocaleString("tr-TR")} aktivite katsayısı ve haftada yaklaşık {draft.workoutDays} antrenmanla yorumlandı.</p><p><strong>Makrolar:</strong> Protein kilo başına yaklaşık {draft.goalType === "maintain" ? "1,6" : "1,8"} g temel alınarak; yağ için makul bir alt sınır korunarak ve kalan enerji karbonhidrata ayrılarak hesaplandı.</p><p>Hesaplar başlangıç tahminidir. Gerçek ihtiyaç uyku, günlük hareket, kayıt doğruluğu ve haftalık eğilime göre değişebilir.</p></div></details>
    <div className="nutrition-medical-note"><AlertTriangle size={16} /><p><strong>Sağlık notu:</strong> Bu hedefler teşhis veya tedavi önerisi değildir. Hamilelik, emzirme, yeme bozukluğu öyküsü, diyabet, böbrek hastalığı ya da başka bir tıbbi durumda kişisel plan için hekim veya diyetisyene danış.</p></div>
  </section>;
}
