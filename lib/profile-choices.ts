// Profildeki antrenman sorularının seçenekleri.
//
// Bu alanlar serbest metindi ("ekipmanlarını yaz", "hedefini yaz"). İki sorun
// vardı: kullanıcıların çoğu boş bırakıyordu, dolduranların yazdığı cümleyi de
// plan üretimi güvenilir biçimde okuyamıyordu. Artık şıklı sorular.
//
// DEĞERLER KANONİK TÜRKÇEDİR: veritabanına ve plan istemine bunlar yazılır,
// arayüz dili ne olursa olsun değişmez (bkz. lib/i18n .profileChoices).
// Onboarding testindeki karşılıklarıyla (lib/i18n answerOptions) aynı yazımı
// kullanırlar, yoksa aynı kavram iki farklı dizeyle saklanırdı.

export const EQUIPMENT_CHOICES = [
  "Hiçbiri",
  "Dambıl",
  "Direnç bandı",
  "Kettlebell",
  "Barfiks demiri",
  "Yoga matı",
  "Salon ekipmanı",
] as const;

export const INJURY_CHOICES = ["Yok", "Bel", "Diz", "Omuz", "Boyun", "Bilek", "Diğer"] as const;

/** Diğerleriyle birlikte işaretlenmesi anlamsız olan cevaplar. */
const EXCLUSIVE = new Set<string>(["Hiçbiri", "Yok"]);

/** Çoklu seçim değerleri tek bir dizede " · " ile saklanır. */
export const CHOICE_SEPARATOR = " · ";

export function parseChoices(value: string): string[] {
  return value.split(CHOICE_SEPARATOR).map((item) => item.trim()).filter(Boolean);
}

export function formatChoices(values: string[]): string {
  return values.join(CHOICE_SEPARATOR);
}

/**
 * Bir seçeneği açar/kapatır.
 *
 * "Hiçbiri" ya da "Yok" seçilirse diğerleri temizlenir; tersine, başka bir
 * şey seçilirse bunlar düşer. Aksi halde "Hiçbiri · Dambıl" gibi kendisiyle
 * çelişen bir değer kaydedilebiliyordu.
 */
export function toggleChoice(current: string[], choice: string): string[] {
  if (current.includes(choice)) return current.filter((item) => item !== choice);
  if (EXCLUSIVE.has(choice)) return [choice];
  return [...current.filter((item) => !EXCLUSIVE.has(item)), choice];
}
