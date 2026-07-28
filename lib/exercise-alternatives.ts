// Salondaki makine doluysa ya da hareket bugün uygun değilse, AYNI BÖLGEYİ
// çalıştıran alternatifleri önerir. Öneriler kullanıcının ekipmanına ve ağrı
// kısıtlarına göre zaten filtrelenmiş bir listeden gelir; bu modül yalnızca
// "hangisi bunun yerine geçer" sorusunu yanıtlar.

export type AlternativeCandidate = {
  name: string;
  area: string;
  bodyweight: boolean;
  requires: string[];
};

/**
 * `current` ile aynı bölgeyi çalıştıran alternatifleri sıralar.
 *
 * Sıralama: önce ekipman gereksinimi daha az olanlar (makine dolu olduğunda
 * asıl ihtiyaç budur), sonra alfabetik — böylece liste her açılışta aynı kalır
 * ve kullanıcı aradığını iki kez farklı yerde aramaz.
 */
export function alternativeExercises<T extends AlternativeCandidate>(
  current: AlternativeCandidate,
  library: T[],
  limit = 4,
): T[] {
  const sameArea = library.filter((item) => item.area === current.area && item.name !== current.name);
  return sameArea
    .slice()
    .sort((a, b) => {
      // Vücut ağırlığı hareketleri her zaman uygulanabilir olduğu için önce gelir.
      if (a.bodyweight !== b.bodyweight) return a.bodyweight ? -1 : 1;
      if (a.requires.length !== b.requires.length) return a.requires.length - b.requires.length;
      return a.name.localeCompare(b.name, "tr");
    })
    .slice(0, Math.max(1, limit));
}
