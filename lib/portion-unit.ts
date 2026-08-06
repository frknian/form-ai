// Porsiyon birimi: gram, mililitre, ev ölçüleri (bardak/kupa/tabak/kase),
// porsiyon ya da adet.
//
// Tüm besin matematiği GRAM üzerinden çalışır (scaleFoodNutrition 100 g bazlı),
// bu yüzden porsiyon ve adet yalnızca giriş kolaylığıdır: kaç tane yediğini
// yazarsın, bir birimin kaç gram olduğu bilgisiyle grama çevrilir.
//
// Referans ağırlık sırayla şuralardan gelir:
//   1. Yemek adına uyan STANDART porsiyon/adet ağırlığı (aşağıdaki tablolar)
//   2. AI'ın analiz ettiği miktar (porsiyon → tamamı; adet → metindeki sayıya
//      bölünmüş hâli, "3 yumurta" gibi)
//   3. Genel varsayılan
//
// Eskiden yalnız 2. adım vardı ve tahmin yokken bu birimler arayüzde kilitli
// duruyordu: kullanıcı "1 porsiyon çorba" yazamıyor, önce analiz ettirmek
// zorunda kalıyordu. Standart tablolar bu kilidi kaldırır; kullanılan gram
// karşılığı arayüzde her zaman gösterilir, kullanıcı katılmıyorsa grama geçip
// kendi değerini yazabilir.

export type PortionUnit = "g" | "ml" | "teaGlass" | "waterGlass" | "mug" | "plate" | "bowl" | "portion" | "piece";

export const PORTION_UNITS: PortionUnit[] = ["g", "ml", "teaGlass", "waterGlass", "mug", "plate", "bowl", "portion", "piece"];

// Arayüzde iki grup: önce ölçülen/parçalı birimler (gram, ml, porsiyon, adet),
// sonra sabit ev ölçüleri (bardak/kupa/tabak/kase). Porsiyon ve adet artık
// bardak/tabak arasında değil, gram/ml'nin yanında durur — kullanıcı tartıyla
// ölçtüğü ya da "1 porsiyon" dediği değeri ikinci grupta aramak zorunda
// kalmıyordu.
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

// --- Standart porsiyon ağırlıkları ---------------------------------------
//
// Türkiye'de yaygın kullanılan tek porsiyon ölçüleri (yaklaşık, gram). Yemek
// adına göre eşlenir; tabloda karşılığı yoksa DEFAULT_PORTION_GRAMS kullanılır.
//
// Değerler tek bir kişinin bir öğünde yediği tipik miktardır — tabaktaki
// hâliyle, pişmiş ağırlık. Kesin tartı değil, makul bir başlangıç noktasıdır:
// arayüz kullanılan gramı gösterir, kullanıcı grama geçip düzeltebilir.
const STANDARD_PORTION_GRAMS: Record<string, number> = {
  // Çorbalar ve sulu yemekler
  çorba: 250, soup: 250,
  // Tahıl ve makarna
  pilav: 150, bulgur: 150, makarna: 200, erişte: 200, kuskus: 150,
  mantı: 200, lazanya: 250, rice: 150, pasta: 200,
  // Et, tavuk, balık
  et: 120, biftek: 150, köfte: 120, kavurma: 100,
  tavuk: 120, hindi: 120, balık: 150, ton: 80, karides: 100,
  döner: 150, kebap: 150, şiş: 150, pastırma: 30, sucuk: 50,
  sosis: 50, salam: 30, jambon: 30,
  meat: 120, chicken: 120, fish: 150, beef: 120,
  // Baklagiller ve sebze yemekleri
  nohut: 200, fasulye: 200, mercimek: 200, barbunya: 200, bakla: 200,
  sebze: 200, yemek: 200, dolma: 200, musakka: 200, türlü: 200,
  // Salata ve mezeler
  salata: 150, meze: 60, cacık: 150, humus: 60, salad: 150,
  // Süt ürünleri
  yoğurt: 200, ayran: 200, süt: 200, kefir: 200, milk: 200, yogurt: 200,
  peynir: 30, kaşar: 30, lor: 60, çökelek: 60, cheese: 30,
  // Ekmek ve unlular
  ekmek: 50, bread: 50, simit: 100, poğaça: 70, açma: 70, börek: 100,
  pide: 200, lahmacun: 150, pizza: 150, tost: 150, sandviç: 200,
  hamburger: 200, gözleme: 200, krep: 100, kruvasan: 60,
  // Kahvaltılık ve tahıl
  yulaf: 40, müsli: 40, granola: 40, gevrek: 30, mısır: 150,
  yumurta: 100, omlet: 150, menemen: 200, egg: 100,
  // Meyve (tek porsiyon ≈ 1 orta boy meyve)
  meyve: 150, fruit: 150, elma: 150, armut: 150, portakal: 150,
  mandalina: 150, muz: 120, şeftali: 150, kayısı: 150, erik: 150,
  kiraz: 150, çilek: 150, kivi: 150, incir: 150, üzüm: 150,
  karpuz: 250, kavun: 250, nar: 150, ananas: 150,
  // Kuruyemiş ve kuru meyve
  kuruyemiş: 30, ceviz: 30, fındık: 30, badem: 30, fıstık: 30,
  leblebi: 30, çekirdek: 30, hurma: 30,
  // Tatlı ve atıştırmalık
  tatlı: 100, baklava: 80, künefe: 150, sütlaç: 150, kek: 80,
  kurabiye: 30, bisküvi: 30, dondurma: 100, çikolata: 30, gofret: 40,
  cips: 30, patates: 150, kızartma: 100,
  // Yağ, sos, tatlandırıcı
  yağ: 10, tereyağı: 10, zeytinyağı: 10, zeytin: 20, reçel: 20,
  bal: 20, pekmez: 20, ketçap: 15, mayonez: 15, sos: 20, şeker: 5,
  // İçecekler
  su: 200, çay: 200, kahve: 200, kola: 250, gazoz: 250, soda: 200,
  smoothie: 250, limonata: 250, şalgam: 200, boza: 200,
  protein: 30, shake: 300, juice: 200,
};

// Tek bir adedin yaklaşık ağırlığı (gram). "Porsiyon" tablosundan ayrıdır:
// 1 porsiyon yumurta 2 adet (100 g) sayılırken 1 ADET yumurta 50 g'dır.
const STANDARD_PIECE_GRAMS: Record<string, number> = {
  // Yumurta ve unlular
  yumurta: 50, egg: 50, ekmek: 25, bread: 25, dilim: 25, tost: 150,
  simit: 100, poğaça: 70, açma: 70, kruvasan: 60, bisküvi: 10,
  kurabiye: 15, gofret: 40, kek: 80, börek: 100, lahmacun: 150,
  pizza: 100, krep: 60, gözleme: 200, sandviç: 200, hamburger: 200,
  // Meyve
  elma: 150, armut: 150, portakal: 150, mandalina: 80, muz: 120,
  şeftali: 120, kayısı: 40, erik: 40, kiraz: 6, çilek: 12, kivi: 75,
  incir: 50, hurma: 8, avokado: 150, limon: 100, greyfurt: 250,
  nar: 250, ayva: 200, karpuz: 300, kavun: 250, üzüm: 5,
  apple: 150, banana: 120, orange: 150,
  // Sebze
  domates: 120, salatalık: 100, biber: 40, soğan: 100, patates: 120,
  havuç: 80, patlıcan: 200, kabak: 150, marul: 300, mısır: 150,
  // Et ve şarküteri
  köfte: 30, sosis: 40, sucuk: 10, salam: 15, pastırma: 5,
  kanat: 40, but: 150, pirzola: 80, şiş: 40,
  // Kuruyemiş ve küçük parçalar
  ceviz: 5, fındık: 1, badem: 1, fıstık: 1, zeytin: 5, şeker: 3,
  çikolata: 10,
};

/** Yemek adı eşlenemediğinde kullanılan genel karşılıklar. */
export const DEFAULT_PORTION_GRAMS = 200;
export const DEFAULT_PIECE_GRAMS = 100;

/**
 * Ünsüz yumuşaması: ünlüyle başlayan bir ek geldiğinde sondaki sert ünsüz
 * yumuşar. "ekmek" → "ekmeği", "balık" → "balığı", "kebap" → "kebabı".
 * Bu olmadan tablodaki kök, çekimli hâliyle yazılmış yemek adını kaçırıyordu.
 */
const SOFTENED_FINALS: Record<string, string> = { k: "ğ", p: "b", ç: "c", t: "d" };

/**
 * Bir ekin makul uzunluğu. "balığı" − "bal" = "ığı" gerçek bir ek gibi görünür,
 * ama "zeytinyağlı" − "zeytin" = "yağlı" yeni bir kökün başlangıcıdır. Sınır,
 * "bal"ın "somon balığı"nı yakalamasını engelleyecek kadar dar olmalı; bunu
 * kelime başına en uzun anahtarı seçerek de destekliyoruz.
 */
const MAX_SUFFIX_LENGTH = 4;

/** Kelime, anahtarın çekimli bir hâli mi? */
function stemMatches(word: string, keyword: string): boolean {
  if (word.startsWith(keyword)) return word.length - keyword.length <= MAX_SUFFIX_LENGTH;
  const softened = SOFTENED_FINALS[keyword.slice(-1)];
  if (!softened) return false;
  const mutated = `${keyword.slice(0, -1)}${softened}`;
  // Yumuşama yalnız ek geldiğinde olur: yalın "ekmeğ" diye bir kelime yoktur.
  return word.startsWith(mutated) && word.length > mutated.length && word.length - mutated.length <= MAX_SUFFIX_LENGTH;
}

/**
 * Yemek adını tablodaki anahtarlarla eşler.
 *
 * Eşleşme KELİME BAŞINDAN yapılır, kelime ortasında aranmaz: yoksa "omlet"
 * içindeki "et" eşleşir ve 120 g'lık et porsiyonu çıkardı.
 *
 * Her kelimede en UZUN anahtar kazanır ("balığı" → bal değil balık), kelimeler
 * arasında ise SONDAKİ: Türkçede tamlamanın ana ismi sonda durur, yani
 * "mercimek çorbası" bir çorbadır (250 g), mercimek yemeği (200 g) değil.
 */
function matchStandardGrams(description: string, table: Record<string, number>): number | null {
  const words = description.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
  let grams: number | null = null;
  for (const word of words) {
    let longest: { length: number; grams: number } | null = null;
    for (const [keyword, keywordGrams] of Object.entries(table)) {
      if (!stemMatches(word, keyword)) continue;
      if (!longest || keyword.length > longest.length) longest = { length: keyword.length, grams: keywordGrams };
    }
    if (longest) grams = longest.grams;
  }
  return grams;
}

/** Yemek adına uyan standart porsiyon ağırlığı; tabloda yoksa null. */
export function standardPortionGrams(description: string): number | null {
  return matchStandardGrams(description, STANDARD_PORTION_GRAMS);
}

/** Yemek adına uyan standart tek adet ağırlığı; tabloda yoksa null. */
export function standardPieceGrams(description: string): number | null {
  return matchStandardGrams(description, STANDARD_PIECE_GRAMS);
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

/**
 * Bir birimin (porsiyon ya da adet) kaç gram olduğu.
 *
 * Standart tablo AI tahmininden ÖNCE gelir. Aksi hâlde "1 porsiyon", analiz
 * sırasında kutuda ne yazıyorsa o olurdu: kullanıcı varsayılan 100 g ile
 * analiz ettiyse 1 porsiyon çorba 100 g sayılırdı. Standart, yemeğin kendi
 * ölçüsünü verir; tahmin yalnızca tabloda karşılığı olmayan yemeklerde
 * (ev usulü karışık tabaklar) devreye girer.
 */
export function referenceGrams(unit: PortionUnit, analysedGrams: number | null, description = ""): number {
  if (unit === "g") return 1;
  const household = HOUSEHOLD_GRAMS[unit];
  if (household !== undefined) return household;
  const analysed = analysedGrams && analysedGrams > 0 ? analysedGrams : null;
  if (unit === "portion") return standardPortionGrams(description) ?? analysed ?? DEFAULT_PORTION_GRAMS;
  const standard = standardPieceGrams(description);
  if (standard !== null) return standard;
  // "3 yumurta = 180 g" analiz edildiyse 1 adet 60 g'dır.
  const count = detectPieceCount(description);
  if (analysed) return count ? analysed / count : analysed;
  return DEFAULT_PIECE_GRAMS;
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
