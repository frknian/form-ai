// Porsiyon birimi: gram ya da adet.
//
// Tüm besin matematiği GRAM üzerinden çalışır (scaleFoodNutrition 100 g bazlı),
// bu yüzden "adet" yalnızca bir giriş kolaylığıdır: kaç adet yediğini yazarsın,
// bir adedin kaç gram olduğu bilgisiyle grama çevrilir.
//
// Bir adedin ağırlığı AI tahmininden gelir: analiz edilen porsiyon "1 adet"
// kabul edilir. Bilinmiyorsa adet seçeneği anlamlı bir sayı üretemez, bu yüzden
// arayüz onu ancak tahmin varken sunar.

export type PortionUnit = "g" | "piece";

export function parseAmount(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Girilen miktarı grama çevirir. Adet için bir adedin gramı gerekir. */
export function toGrams(value: string, unit: PortionUnit, gramsPerPiece: number | null): number | null {
  const amount = parseAmount(value);
  if (amount === null) return null;
  if (unit === "g") return amount;
  if (!gramsPerPiece || gramsPerPiece <= 0) return null;
  return amount * gramsPerPiece;
}

/** Gramı seçili birimdeki girdi metnine çevirir (birim değiştirilince kullanılır). */
export function fromGrams(grams: number, unit: PortionUnit, gramsPerPiece: number | null): string {
  if (unit === "g") return String(Math.round(grams));
  if (!gramsPerPiece || gramsPerPiece <= 0) return "";
  const pieces = grams / gramsPerPiece;
  // Adet çoğunlukla tam sayıdır; yarım porsiyonu da ifade edebilmek için
  // yalnızca gerektiğinde tek ondalık gösterilir.
  return Number.isInteger(Number(pieces.toFixed(1))) ? String(Math.round(pieces)) : pieces.toFixed(1);
}
