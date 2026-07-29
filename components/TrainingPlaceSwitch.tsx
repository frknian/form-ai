"use client";

type TrainingPlace = "Evde" | "Salon";

type TrainingPlaceSwitchProps = {
  value: TrainingPlace;
  onChange: (value: TrainingPlace) => void;
  label?: string;
  homeLabel?: string;
  homeHint?: string;
  gymLabel?: string;
  gymHint?: string;
};

export function TrainingPlaceSwitch({ value, onChange, label = "Antrenman ortamı", homeLabel = "Ev", homeHint = "Kendi ekipmanların", gymLabel = "Spor salonu", gymHint = "Salon ekipmanları" }: TrainingPlaceSwitchProps) {
  return <fieldset className="training-place-fieldset">
    <legend>{label}</legend>
    <div className="training-place-switch">
      <span className={value === "Salon" ? "switch-track salon" : "switch-track"} aria-hidden="true"><i /></span>
      <button type="button" aria-pressed={value === "Evde"} className={value === "Evde" ? "active" : ""} onClick={() => onChange("Evde")}><strong>{homeLabel}</strong><small>{homeHint}</small></button>
      <button type="button" aria-pressed={value === "Salon"} className={value === "Salon" ? "active" : ""} onClick={() => onChange("Salon")}><strong>{gymLabel}</strong><small>{gymHint}</small></button>
    </div>
  </fieldset>;
}
