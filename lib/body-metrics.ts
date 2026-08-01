// Boy/kilo seçicilerinin saf mantığı.
//
// Onboarding'de boy ve kilo düz sayı kutularıydı: telefonda klavye açtırıyor,
// yanlış birim ("1.73") yazılabiliyor ve kullanıcı girdiği değerin makul olup
// olmadığını göremiyordu. Görsel seçiciler bu değerleri kaydırarak seçtiriyor;
// burada da aralık sınırları ve görsel konum hesapları tutuluyor.

export type Range = { min: number; max: number; step: number };

// Sınırlar tıbbi bir yargı değil, yalnız kaydırıcının işe yarar kalması için.
// Dışında kalan bir değer kaydedilmiş olabilir (ör. eski profil); okurken
// kırpıyoruz ama kullanıcıyı uyarmıyoruz.
export const HEIGHT_RANGE: Range = { min: 120, max: 220, step: 1 };
export const WEIGHT_RANGE: Range = { min: 30, max: 250, step: 1 };

export const DEFAULT_HEIGHT_CM = 170;
export const DEFAULT_WEIGHT_KG = 70;

export function clampToRange(value: number, range: Range): number {
  if (!Number.isFinite(value)) return range.min;
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

/**
 * Metin kutusundan gelen değeri sayıya çevirir; boş/bozuksa varsayılana döner.
 * Değerler uygulamada dize olarak taşınır (form state'i), bu yüzden gerekli.
 */
export function readMeasure(value: string, range: Range, fallback: number): number {
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return clampToRange(parsed, range);
}

/** Kaydırıcının dolu oranı (%). Görsel çubuğu ve silueti bununla ölçekliyoruz. */
export function rangePercent(value: number, range: Range): number {
  const span = range.max - range.min;
  if (span <= 0) return 0;
  return Math.min(100, Math.max(0, ((clampToRange(value, range) - range.min) / span) * 100));
}

export type BmiCategory = "underweight" | "normal" | "overweight" | "obese";

export function bodyMassIndex(heightCm: number, weightKg: number): number | null {
  const meters = heightCm / 100;
  if (!Number.isFinite(meters) || meters <= 0 || !Number.isFinite(weightKg) || weightKg <= 0) return null;
  return Math.round((weightKg / (meters * meters)) * 10) / 10;
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

// Göstergedeki ölçek. 15'in altı ve 40'ın üstü uçlara yapışır; amaç tanı değil,
// kullanıcının girdiği ölçülerin nereye düştüğünü görmesi.
const BMI_SCALE = { min: 15, max: 40 };

export function bmiScalePercent(bmi: number): number {
  const span = BMI_SCALE.max - BMI_SCALE.min;
  return Math.min(100, Math.max(0, ((bmi - BMI_SCALE.min) / span) * 100));
}

/** Ölçek üzerinde kategori sınırlarının nereye düştüğü — çubuğu bölmek için. */
export const BMI_BOUNDARIES = [18.5, 25, 30].map((value) => ({ value, percent: bmiScalePercent(value) }));

/**
 * Siluetin kutu içindeki yükseklik oranı (%).
 *
 * Doğrudan rangePercent kullanmak 120 cm'i sıfır yükseklikte, yani görünmez
 * bir çizgi yapardı; en kısa boy da tanınabilir kalmalı.
 */
export function silhouettePercent(heightCm: number): number {
  return 55 + (rangePercent(heightCm, HEIGHT_RANGE) / 100) * 45;
}
