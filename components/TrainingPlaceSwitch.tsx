"use client";

type TrainingPlace = "Evde" | "Salon";

type TrainingPlaceSwitchProps = {
  value: TrainingPlace;
  onChange: (value: TrainingPlace) => void;
  label?: string;
};

export function TrainingPlaceSwitch({ value, onChange, label = "Antrenman ortamı" }: TrainingPlaceSwitchProps) {
  return <fieldset className="training-place-fieldset">
    <legend>{label}</legend>
    <div className="training-place-switch">
      <span className={value === "Salon" ? "switch-track salon" : "switch-track"} aria-hidden="true"><i /></span>
      <button type="button" aria-pressed={value === "Evde"} className={value === "Evde" ? "active" : ""} onClick={() => onChange("Evde")}><strong>Ev</strong><small>Kendi ekipmanların</small></button>
      <button type="button" aria-pressed={value === "Salon"} className={value === "Salon" ? "active" : ""} onClick={() => onChange("Salon")}><strong>Spor salonu</strong><small>Salon ekipmanları</small></button>
    </div>
  </fieldset>;
}
