// Geçmiş kayıtlardan "tek dokunuşla tekrar ekle" önerileri çıkarır.
// İnsanlar büyük ölçüde aynı şeyleri yiyor; günlük en tekrarlı işi kısaltmak
// için AI'ya hiç ihtiyaç yoktur, kendi geçmişi yeter (bu yüzden kotayı da
// harcamaz).

export type MealLike = {
  name: string;
  meal: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  grams?: number;
  consumedAt: string;
};

export type FrequentMeal<T extends MealLike = MealLike> = {
  /** Aynı yemeğin tekrarlarını birleştiren anahtar. */
  key: string;
  count: number;
  lastConsumedAt: string;
  entry: T;
};

const RECENT_WINDOW_DAYS = 30;

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
}

/**
 * Son 30 günün kayıtlarını ada göre gruplar ve en sık yenenleri döndürür.
 *
 * Sıralama önce TEKRAR SAYISI, eşitlikte daha yeni olan. Böylece "her sabah
 * yediğin kahvaltı" tek seferlik bir kaydın önüne geçer. Bugünün kayıtları
 * hariç tutulur — zaten ekranda duran bir öğünü tekrar önermek gürültüdür.
 */
export function frequentMeals<T extends MealLike>(entries: T[], options: { today: string; limit?: number }): FrequentMeal<T>[] {
  const limit = options.limit ?? 6;
  const cutoff = Date.parse(`${options.today}T00:00:00.000Z`) - RECENT_WINDOW_DAYS * 86_400_000;
  const groups = new Map<string, FrequentMeal<T>>();

  for (const entry of entries) {
    const time = Date.parse(entry.consumedAt);
    if (!Number.isFinite(time) || time < cutoff) continue;
    if (entry.consumedAt.slice(0, 10) === options.today) continue;
    const name = normalizeName(entry.name);
    if (!name) continue;
    const key = `${name}|${entry.meal}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { key, count: 1, lastConsumedAt: entry.consumedAt, entry });
      continue;
    }
    existing.count += 1;
    // En güncel kaydı temsilci tut: porsiyon/makro zamanla düzeltilmiş olabilir.
    if (entry.consumedAt > existing.lastConsumedAt) {
      existing.lastConsumedAt = entry.consumedAt;
      existing.entry = entry;
    }
  }

  return [...groups.values()]
    .sort((a, b) => b.count - a.count || b.lastConsumedAt.localeCompare(a.lastConsumedAt))
    .slice(0, Math.max(1, limit));
}
