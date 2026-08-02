// Porsiyon birimi: gram, mililitre, ev ölçüleri (bardak/kupa/tabak/kase),
// porsiyon ya da adet.
//
// Tüm besin matematiği GRAM üzerinden çalışır (scaleFoodNutrition 100 g bazlı),
// bu yüzden porsiyon ve adet yalnızca giriş kolaylığıdır: kaç tane yediğini
// yazarsın, bir birimin kaç gram olduğu bilgisiyle grama çevrilir.
//
// Referans ağırlık AI tahmininden gelir:
//   • porsiyon → AI'ın analiz ettiği miktarın tamamı "1 porsiyon" sayılır
//   • adet     → metinde bir sayı geçiyorsa ("3 yumurta") analiz o sayıya
//                bölünür; geçmiyorsa analiz edilen miktar tek adet kabul edilir
//
// Referans bilinmiyorsa bu birimler anlamlı bir gram üretemez, o yüzden arayüz
// onları ancak tahmin varken sunar — uydurma bir ağırlıkla devam etmek sessizce
// yanlış kalori kaydeder.

export type PortionUnit = "g" | "ml" | "teaGlass" | "waterGlass" | "mug" | "plate" | "bowl" | "portion" | "piece";

export const PORTION_UNITS: PortionUnit[] = ["g", "ml", "teaGlass", "waterGlass", "mug", "plate", "bowl", "portion", "piece"];

// Arayüzde iki grup: önce ölçülen/parçalı birimler (gram, ml, porsiyon, adet),
// sonra sabit ev ölçüleri (bardak/kupa/tabak/kase). Porsiyon ve adet AI
// tahminine bağlı kalır (needsAnalysis) ama artık bardak/tabak arasında değil,
// gram/ml'nin yanında durur — kullanıcı tartıyla ölçtüğü ya da "1 porsiyon"
// dediği değeri ikinci grupta aramak zorunda kalmıyordu.
export const PRIMARY_PORTION_UNITS: PortionUnit[] = ["g", "ml", "portion", "piece"];
export const HOUSEHOLD_PORTION_UNITS: PortionUnit[] = ["teaGlass", "waterGlass", "mug", "plate", "bowl"];

// Ev ölçülerinin yaklaşık gram karşılığı. Bunlar SABİTTİR: porsiyon ve adetten
// farklı olarak bir AI tahminine ihtiyaç duymazlar, çünkü bir su bardağının
// hacmi yemekten yemeğe değişmez.
//
// ml → g dönüşümü suyun yoğunluğunu (1 g/ml) varsayar. Yağ (~0,92) ve bal
// (~1,4) gibi sıvılarda sapar; bu yüzden arayüzde "yaklaşık" denir. Tabak ve
// kase ise hacim değil, tipik bir porsiyon ağırlığıdır.
const HOUSEHOLD_GRAMS: Partial<Record<PortionUnit, number>> = {
  ml: 1,
  teaGlass: 110,
  waterGlass: 200,
  mug: 250,
  plate: 350,
  bowl: 250,
};

/** Bu birimler AI tahmini olmadan hesaplanamaz (referansları yemeğe özgüdür). */
export const UNITS_NEEDING_ANALYSIS: PortionUnit[] = ["portion", "piece"];

export function needsAnalysis(unit: PortionUnit): boolean {
  return UNITS_NEEDING_ANALYSIS.includes(unit);
}

export function parseAmount(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Yemek tarifinde geçen adet sayısını çıkarır ("3 yumurta" → 3).
 *
 * Yalnızca baştaki sayıyı okur: "2 dilim ekmek" 2 verir, ama "500 g tavuk"
 * gibi ölçü birimi taşıyan ifadeler adet sayılmaz, aksi halde 500 adet
 * tavuk gibi saçma bir referans çıkardı.
 */
export function detectPieceCount(description: string): number | null {
  const match = description.trim().match(/^(\d+(?:[.,]\d+)?)\s*(\p{L}+)/u);
  if (!match) return null;
  const count = Number(match[1].replace(",", "."));
  if (!Number.isFinite(count) || count <= 0 || count > 50) return null;
  const unitWord = match[2].toLocaleLowerCase("tr-TR");
  const measureWords = ["g", "gr", "gram", "kg", "ml", "l", "litre", "cl"];
  if (measureWords.includes(unitWord)) return null;
  return count;
}

/** Bir birimin (porsiyon ya da adet) kaç gram olduğu. */
export function referenceGrams(unit: PortionUnit, analysedGrams: number | null, description = ""): number | null {
  if (unit === "g") return 1;
  const household = HOUSEHOLD_GRAMS[unit];
  if (household !== undefined) return household;
  if (!analysedGrams || analysedGrams <= 0) return null;
  if (unit === "portion") return analysedGrams;
  const count = detectPieceCount(description);
  return count ? analysedGrams / count : analysedGrams;
}

/** Girilen miktarı grama çevirir. Gram dışı birimler referans ağırlık ister. */
export function toGrams(value: string, unit: PortionUnit, unitGrams: number | null): number | null {
  const amount = parseAmount(value);
  if (amount === null) return null;
  if (unit === "g") return amount;
  if (!unitGrams || unitGrams <= 0) return null;
  return amount * unitGrams;
}

/** Gramı seçili birimdeki girdi metnine çevirir (birim değiştirilince kullanılır). */
export function fromGrams(grams: number, unit: PortionUnit, unitGrams: number | null): string {
  if (unit === "g") return String(Math.round(grams));
  if (!unitGrams || unitGrams <= 0) return "";
  const amount = grams / unitGrams;
  // Çoğunlukla tam sayıdır; yarım porsiyonu ifade edebilmek için yalnızca
  // gerektiğinde tek ondalık gösterilir.
  return Number.isInteger(Number(amount.toFixed(1))) ? String(Math.round(amount)) : amount.toFixed(1);
}
