"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { localDateKey } from "@/lib/streak";
import { sanitizeNutritionGoal } from "@/lib/nutrition-goals";
import { useTranslations } from "@/lib/i18n/translate";

const CIRCUMFERENCE = 2 * Math.PI * 42;

/**
 * Ana ekranın kalori çemberi: BUGÜN alınması gereken kaloriden geriye ne
 * kaldığını gösterir. Alınan öğünler düşer, antrenmanda harcanan geri eklenir
 * — kullanıcı "bugün daha ne yiyebilirim?" sorusunun cevabını tek bakışta
 * görsün diye. BMR/TDEE gibi ham sayılar burada değil, ilerleme sekmesinde.
 *
 * `burnedKcal`: bugün kaydedilen antrenman/aktivite yakımı (ebeveyn hesaplar).
 * `fallbackTargetKcal`: beslenme sekmesi hiç açılmamışsa profilden gelen TDEE.
 */
export function DailyEnergyRing({ userId, burnedKcal, fallbackTargetKcal }: { userId?: string; burnedKcal: number; fallbackTargetKcal?: number | null }) {
  const t = useTranslations();
  const [consumed, setConsumed] = useState(0);
  const [savedTarget, setSavedTarget] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      if (!supabase) return;
      const today = localDateKey();
      const [goalResult, entryResult] = await Promise.all([
        supabase.from("nutrition_goals").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("food_entries").select("calories, consumed_at").order("consumed_at", { ascending: false }).limit(100),
      ]);
      if (cancelled) return;
      const goal = goalResult.data ? sanitizeNutritionGoal({
        goalType: goalResult.data.goal_type,
        calorieTarget: goalResult.data.calorie_target,
        proteinGrams: goalResult.data.protein_g,
        carbsGrams: goalResult.data.carbs_g,
        fatGrams: goalResult.data.fat_g,
        bmr: goalResult.data.bmr,
        tdee: goalResult.data.tdee,
        calorieAdjustment: goalResult.data.calorie_adjustment,
        activityFactor: goalResult.data.activity_factor,
        workoutDays: goalResult.data.workout_days,
        isManual: goalResult.data.is_manual,
      }) : null;
      setSavedTarget(goal ? goal.calorieTarget : null);
      setConsumed(Math.round((entryResult.data || [])
        .filter((row) => localDateKey(new Date(String(row.consumed_at))) === today)
        .reduce((total, row) => total + (Number(row.calories) || 0), 0)));
    }
    void load();
    // Öğün eklenip silindiğinde çember bayatlamasın.
    function refresh() { void load(); }
    window.addEventListener("fit-ai-nutrition-changed", refresh);
    window.addEventListener("fit-ai-progress-reset", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("fit-ai-nutrition-changed", refresh);
      window.removeEventListener("fit-ai-progress-reset", refresh);
    };
  }, [userId]);

  const target = savedTarget ?? (Number.isFinite(Number(fallbackTargetKcal)) && Number(fallbackTargetKcal) > 0 ? Math.round(Number(fallbackTargetKcal)) : null);
  const burned = Math.max(0, Math.round(burnedKcal) || 0);
  const budget = target === null ? null : target + burned;
  const remaining = budget === null ? null : budget - consumed;

  const dash = useMemo(() => {
    if (budget === null) return 0;
    const used = Math.min(1, Math.max(0, consumed / Math.max(1, budget)));
    return CIRCUMFERENCE * used;
  }, [budget, consumed]);

  const over = remaining !== null && remaining < 0;

  return <div className={over ? "energy-ring-card over" : "energy-ring-card"}>
    <div className="energy-ring" role="img" aria-label={remaining === null ? t.dashboard.energyRingNoTarget : t.dashboard.energyRingLabel(Math.abs(remaining))}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="energy-ring-track" cx="50" cy="50" r="42" />
        <circle className="energy-ring-fill" cx="50" cy="50" r="42" strokeDasharray={`${dash} ${CIRCUMFERENCE}`} />
      </svg>
      <div className="energy-ring-center">
        <strong>{remaining === null ? "—" : Math.abs(remaining)}</strong>
        <small>{remaining === null ? t.dashboard.energyNoTarget : over ? t.dashboard.energyOver : t.dashboard.energyRemaining}</small>
      </div>
    </div>
    <div className="energy-ring-legend">
      <div><span>{t.dashboard.energyConsumed}</span><strong>{consumed}<small>kcal</small></strong></div>
      <div><span>{t.dashboard.energyBurned}</span><strong>{burned}<small>kcal</small></strong></div>
      {target !== null && <div><span>{t.dashboard.energyTarget}</span><strong>{target}<small>kcal</small></strong></div>}
    </div>
  </div>;
}
