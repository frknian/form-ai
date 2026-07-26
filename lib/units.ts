export type WeightUnit = "kg" | "lb";

const LB_PER_KG = 2.2046226218;

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === "lb" ? kg * LB_PER_KG : kg;
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === "lb" ? value / LB_PER_KG : value;
}

// Kullanıcının girdiği metni (seçili birimde) kg cinsine çevirir.
export function parseWeightInputToKg(value: string, unit: WeightUnit): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(unitToKg(parsed, unit) * 100) / 100;
}

// kg değerini, seçili birimde input alanına konulacak metne çevirir.
export function kgToInputValue(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return "";
  const value = kgToUnit(kg, unit);
  return String(Math.round(value * 10) / 10);
}

export function formatWeight(kg: number | null | undefined, unit: WeightUnit, options?: { decimals?: number; withUnit?: boolean }): string {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return "—";
  const value = kgToUnit(kg, unit);
  const decimals = options?.decimals ?? (Number.isInteger(value) ? 0 : 1);
  const number = value.toLocaleString("tr-TR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return options?.withUnit === false ? number : `${number} ${unit}`;
}

export function weightUnitLabel(unit: WeightUnit): string {
  return unit;
}
