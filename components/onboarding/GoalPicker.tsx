"use client";

import { OnboardingIcon } from "./OnboardingIcon";
import { GOAL_PRESETS, matchGoalPreset } from "@/lib/goal-presets";
import { useTranslations } from "@/lib/i18n/translate";

/**
 * Hızlı hedef kartları. Seçim, altındaki metin kutusuna kanonik cümleyi yazar;
 * kullanıcı cümleyi düzenlerse seçim kendiliğinden düşer.
 */
export function GoalPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const t = useTranslations();
  const selected = matchGoalPreset(value);

  return (
    <div className="goal-picker">
      <div className="metric-legend">{t.onboarding.goalPresetsLabel}</div>
      <div className="option-cards option-cards-3">
        {GOAL_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.id}
            className={selected === preset.id ? "option-card selected" : "option-card"}
            aria-pressed={selected === preset.id}
            // Seçili karta tekrar basmak seçimi kaldırır; yanlış dokunan
            // kullanıcı metni elle silmek zorunda kalmasın.
            onClick={() => onChange(selected === preset.id ? "" : preset.text)}
          >
            <OnboardingIcon name={preset.icon} />
            <span>{t.onboarding.goalPresets[preset.id]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
