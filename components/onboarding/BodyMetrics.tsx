"use client";

import type { Dispatch, SetStateAction } from "react";
import { OnboardingIcon, type OnboardingIconName } from "./OnboardingIcon";
import {
  BMI_BOUNDARIES,
  DEFAULT_HEIGHT_CM,
  DEFAULT_WEIGHT_KG,
  HEIGHT_RANGE,
  WEIGHT_RANGE,
  bmiCategory,
  bmiScalePercent,
  bodyMassIndex,
  clampToRange,
  readMeasure,
  rangePercent,
  silhouettePercent,
  type Range,
} from "@/lib/body-metrics";
import { useTranslations } from "@/lib/i18n/translate";

// Cinsiyet değerleri veritabanında Türkçe kanonik olarak saklanır
// (ProfileManager'daki <select> ile aynı üç değer). Yalnız etiket çevrilir.
const GENDERS: { value: string; icon: OnboardingIconName }[] = [
  { value: "Kadın", icon: "female" },
  { value: "Erkek", icon: "male" },
  { value: "Belirtmek istemiyorum", icon: "neutral" },
];

type MeasureProps = {
  value: number;
  range: Range;
  /** Kaydırıcı: mutlak değer. */
  onSet: (next: number) => void;
  /** Artır/azalt: göreli. Hızlı ardışık dokunuşların birbirini ezmemesi için
      mutlak değer yerine adım gönderilir (bkz. BodyMetrics'teki stepBy). */
  onStep: (delta: number) => void;
  label: string;
  unit: string;
  icon: OnboardingIconName;
  decreaseLabel: string;
  increaseLabel: string;
  children?: React.ReactNode;
};

function MeasureField({ value, range, onSet, onStep, label, unit, icon, decreaseLabel, increaseLabel, children }: MeasureProps) {
  const percent = rangePercent(value, range);
  return (
    <div className="measure-field">
      <div className="measure-head">
        <span className="measure-label"><OnboardingIcon name={icon} />{label}</span>
      </div>
      {children}
      <div className="measure-readout">
        <button type="button" className="measure-step" aria-label={decreaseLabel} onClick={() => onStep(-range.step)}>−</button>
        <strong><b>{value}</b><small>{unit}</small></strong>
        <button type="button" className="measure-step" aria-label={increaseLabel} onClick={() => onStep(range.step)}>+</button>
      </div>
      {/* Dolu kısım ayrı bir katman: range input'un kendi "progress" desteği
          tarayıcılar arasında tutarsız, tek görünüm için elle çiziyoruz. */}
      <div className="measure-slider" style={{ ["--fill" as string]: `${percent}%` }}>
        <input
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={value}
          aria-label={label}
          onChange={(event) => onSet(clampToRange(Number(event.target.value), range))}
        />
      </div>
      <div className="measure-scale"><span>{range.min}</span><span>{range.max}</span></div>
    </div>
  );
}

export function BodyMetrics({
  gender, onGenderChange,
  height, onHeightChange,
  weight, onWeightChange,
}: {
  gender: string;
  onGenderChange: (next: string) => void;
  height: string;
  onHeightChange: Dispatch<SetStateAction<string>>;
  weight: string;
  onWeightChange: Dispatch<SetStateAction<string>>;
}) {
  const t = useTranslations();
  const heightValue = readMeasure(height, HEIGHT_RANGE, DEFAULT_HEIGHT_CM);
  const weightValue = readMeasure(weight, WEIGHT_RANGE, DEFAULT_WEIGHT_KG);

  // Hızlı ardışık dokunuşlarda her tıklayıcı aynı render'ın değerini okuyup
  // birbirini eziyordu (10 kez "+" bir adım ilerletiyordu). Güncelleyici biçim
  // her zaman en son değeri görür.
  function stepBy(setter: Dispatch<SetStateAction<string>>, range: Range, fallback: number) {
    return (delta: number) => setter((previous) => String(clampToRange(readMeasure(previous, range, fallback) + delta, range)));
  }
  const bmi = bodyMassIndex(heightValue, weightValue);
  const category = bmi === null ? null : bmiCategory(bmi);
  const categoryLabel = category === null ? "" : t.onboarding.bmiCategories[category];

  return (
    <div className="body-metrics">
      <fieldset className="metric-group">
        <legend className="metric-legend">{t.onboarding.genderLabel}</legend>
        <div className="option-cards option-cards-3">
          {GENDERS.map((option) => (
            <button
              type="button"
              key={option.value}
              className={gender === option.value ? "option-card selected" : "option-card"}
              aria-pressed={gender === option.value}
              onClick={() => onGenderChange(option.value)}
            >
              <OnboardingIcon name={option.icon} />
              <span>{option.value === "Kadın" ? t.onboarding.genderFemale : option.value === "Erkek" ? t.onboarding.genderMale : t.onboarding.genderPreferNotToSay}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="measure-grid">
        <MeasureField
          value={heightValue}
          range={HEIGHT_RANGE}
          onSet={(next) => onHeightChange(String(next))}
          onStep={stepBy(onHeightChange, HEIGHT_RANGE, DEFAULT_HEIGHT_CM)}
          label={t.onboarding.heightShort}
          unit="cm"
          icon="height"
          decreaseLabel={t.onboarding.decreaseLabel(t.onboarding.heightShort)}
          increaseLabel={t.onboarding.increaseLabel(t.onboarding.heightShort)}
        >
          <div className="measure-visual" aria-hidden="true">
            <span className="measure-figure" style={{ height: `${silhouettePercent(heightValue)}%` }}>
              <i className="measure-figure-head" />
              <i className="measure-figure-body" />
            </span>
          </div>
        </MeasureField>

        <MeasureField
          value={weightValue}
          range={WEIGHT_RANGE}
          onSet={(next) => onWeightChange(String(next))}
          onStep={stepBy(onWeightChange, WEIGHT_RANGE, DEFAULT_WEIGHT_KG)}
          label={t.onboarding.weightShort}
          unit="kg"
          icon="weight"
          decreaseLabel={t.onboarding.decreaseLabel(t.onboarding.weightShort)}
          increaseLabel={t.onboarding.increaseLabel(t.onboarding.weightShort)}
        >
          {/* Kilo için silüet yerine ölçek: disk, aralık içindeki konuma göre
              büyür. Kullanıcı sayıya bakmadan da nerede olduğunu görür. */}
          <div className="measure-visual" aria-hidden="true">
            <span className="measure-disc" style={{ transform: `scale(${0.5 + (rangePercent(weightValue, WEIGHT_RANGE) / 100) * 0.5})` }}>
              <OnboardingIcon name="weight" />
            </span>
          </div>
        </MeasureField>
      </div>

      {bmi !== null && (
        <div className="bmi-readout">
          <div className="bmi-head">
            <span className="metric-legend">{t.onboarding.bmiLabel}</span>
            <strong>{bmi.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <small>{categoryLabel}</small></strong>
          </div>
          <div className="bmi-bar">
            {BMI_BOUNDARIES.map((boundary) => <i key={boundary.value} className="bmi-tick" style={{ left: `${boundary.percent}%` }} />)}
            <span className="bmi-marker" style={{ left: `${bmiScalePercent(bmi)}%` }} />
          </div>
          <p className="bmi-note">{t.onboarding.bmiNote}</p>
        </div>
      )}
    </div>
  );
}
