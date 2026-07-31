// Kullanıcının serbest metinle yazdığı ekipmanı hareket gereksinimleriyle eşler.
//
// Önceki hâli ham metinde alt dize arıyordu (`equipment.includes("dambıl")`).
// İki yönlü hata veriyordu:
//   • "dambılım yok" → "dambıl" içerdiği için dambıl hareketleri PLANA GİRİYORDU
//   • "dumbbell" / "dumbell" yazan kullanıcı hiç eşleşmiyordu
// Bu yüzden metni önce cümleciklere bölüp OLUMSUZ olanları atıyor, sonra da
// eşanlamlılar üzerinden eşliyoruz.

const NEGATIONS = ["yok", "yoktur", "hiç", "hicbir", "hiçbir", "değil", "degil", "bulunmuyor", "almadım", "almadim", "istemiyorum"];

// Katalogdaki `requires` değerleri anahtar; kullanıcının yazabileceği biçimler değer.
const SYNONYMS: Record<string, string[]> = {
  "dambıl": ["dambil", "dumbbell", "dumbell", "dumbel", "halter"],
  "kettlebell": ["kettlebell", "kettlbell", "girya"],
  "band": ["band", "bant", "lastik", "direnc", "direnç"],
  "lastik": ["lastik", "band", "bant"],
  "bench": ["bench", "sehpa", "bank", "sedye"],
  "sehpa": ["sehpa", "bench", "bank"],
  "barfiks": ["barfiks", "pull up", "pull-up", "cekme demiri", "çekme demiri"],
  "makine": ["makine", "machine"],
  "salon": ["salon", "gym", "spor salonu"],
};

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Olumsuz cümlecikleri ayıklanmış ekipman metni.
 * "2 dambıl var, bench yok" → "2 dambil var"
 */
export function usableEquipmentText(equipmentText: string): string {
  return normalize(equipmentText)
    .split(/[\n,;.]+|\bve\b|\bama\b|\bfakat\b/)
    .map((clause) => clause.trim())
    .filter((clause) => clause && !NEGATIONS.some((negation) => clause.includes(normalize(negation))))
    .join(" , ");
}

/**
 * Kullanıcının `requirement` ile tanımlanan ekipmana sahip olup olmadığı.
 * Gereksinimin kendisi ve eşanlamlıları aranır.
 */
export function hasEquipment(equipmentText: string, requirement: string): boolean {
  const usable = usableEquipmentText(equipmentText);
  if (!usable) return false;
  const key = normalize(requirement);
  const candidates = new Set<string>([key, ...(SYNONYMS[requirement] ?? []).map(normalize)]);
  return [...candidates].some((candidate) => candidate.length > 0 && usable.includes(candidate));
}

/**
 * Hareketin kullanıcının ortamı ve ekipmanıyla yapılabilir olup olmadığı.
 * Salonda her şey, evde yalnızca vücut ağırlığı veya sahip olunan ekipman.
 */
export function canPerformExercise(
  exercise: { bodyweight: boolean; requires: string[] },
  options: { isGym: boolean; equipmentText: string },
): boolean {
  if (options.isGym) return true;
  if (exercise.bodyweight) return true;
  return exercise.requires.some((requirement) => hasEquipment(options.equipmentText, requirement));
}
