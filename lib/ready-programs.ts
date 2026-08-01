// Hazır programlar sabit isim listeleriydi; bu iki soruna yol açıyordu:
// kataloğa hareket eklenince güncellenmiyorlardı ve "ekipmansız" programa
// ekipmanlı hareket sızabiliyordu. Artık ekipman profiline göre katalogdan
// üretiliyorlar, böylece profil sözü kod tarafından garanti ediliyor.

import { hasEquipment } from "./equipment-match.ts";

export type EquipmentProfile = "equipmentFree" | "dumbbell" | "band" | "gym";

export type CatalogExercise = {
  name: string;
  area: string;
  requires: string[];
  bodyweight: boolean;
};

export const EQUIPMENT_PROFILES: EquipmentProfile[] = ["equipmentFree", "dumbbell", "band", "gym"];

const DUMBBELL_TOKENS = ["dambıl", "kettlebell"];
const BAND_TOKENS = ["band", "lastik"];
// Salonda yalnız makineler değil, serbest ağırlıklar da vardır; salon profili
// bu yüzden dışlayıcı değil, en geniş olanıdır.
const GYM_TOKENS = ["makine", "salon", "leg press", "lat pulldown", "kablo", "bench", "sehpa", "barfiks"];

function requiresAny(exercise: CatalogExercise, tokens: string[]) {
  return exercise.requires.some((requirement) => tokens.some((token) => requirement.includes(token)));
}

/** Hareketin verilen ekipman profiliyle yapılabilir olup olmadığı. */
export function matchesProfile(exercise: CatalogExercise, profile: EquipmentProfile): boolean {
  if (profile === "equipmentFree") return exercise.bodyweight;
  // Diğer profillerde vücut ağırlığı hareketleri de geçerlidir: dambılı olan
  // biri şınav da yapabilir, plank de. Dışlamak programı gereksiz daraltırdı.
  if (exercise.bodyweight) return true;
  if (profile === "dumbbell") return requiresAny(exercise, DUMBBELL_TOKENS);
  if (profile === "band") return requiresAny(exercise, BAND_TOKENS);
  return requiresAny(exercise, [...GYM_TOKENS, ...DUMBBELL_TOKENS, ...BAND_TOKENS]);
}

/**
 * Kullanıcının ortamı ve serbest metinle yazdığı ekipmandan "AI Programı"
 * kartı için otomatik profil çıkarır. Salondaysa salon; değilse yazdığı
 * metinde dambıl/kettlebell veya direnç bandı geçiyorsa o profil; hiçbiri
 * yoksa ekipmansız kabul edilir.
 */
export function detectUserEquipmentProfile(isGym: boolean, equipmentText: string): EquipmentProfile {
  if (isGym) return "gym";
  if (hasEquipment(equipmentText, "dambıl") || hasEquipment(equipmentText, "kettlebell")) return "dumbbell";
  if (hasEquipment(equipmentText, "band")) return "band";
  return "equipmentFree";
}

// Profilin ASIL ekipmanı. Bir hareket profile uyuyor olabilir ama o ekipmanı
// kullanmıyor olabilir: salonda sırt için lat pulldown dururken bant önermek
// zayıf bir program olurdu. Bu yüzden önce asıl ekipmanı kullananlar gelir.
const PRIMARY_TOKENS: Record<EquipmentProfile, string[]> = {
  equipmentFree: [],
  dumbbell: DUMBBELL_TOKENS,
  band: BAND_TOKENS,
  gym: GYM_TOKENS,
};

/** Adayları profile uygunluk derecesine göre sıralar; sıra deterministik kalır. */
function rankForProfile<T extends CatalogExercise>(candidates: T[], profile: EquipmentProfile): T[] {
  if (profile === "equipmentFree") return candidates;
  const tier = (exercise: T) => {
    if (requiresAny(exercise, PRIMARY_TOKENS[profile])) return 0;
    if (!exercise.bodyweight) return 1;
    return 2;
  };
  return candidates.slice().sort((a, b) => tier(a) - tier(b) || a.name.localeCompare(b.name, "tr"));
}

// Dengeli bir seans için önce bu bölgelerden birer hareket alınır; hepsi bacak
// ya da hepsi core olan bir program işe yaramaz.
const PRIORITY_AREAS = ["Bacak", "Göğüs", "Sırt", "Omuz", "Core"];

/**
 * Profile uyan hareketlerden dengeli bir program üretir.
 *
 * Önce öncelikli bölgelerden birer hareket seçilir, kalan slotlar geri kalandan
 * doldurulur. Sıralama alfabetiktir: program her açılışta aynı kalmalı, aksi
 * halde kullanıcı dün yaptığı hareketi bugün bulamaz.
 */
export function buildReadyProgram<T extends CatalogExercise>(library: T[], profile: EquipmentProfile, count = 5): T[] {
  const eligible = library
    .filter((exercise) => matchesProfile(exercise, profile))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const chosen: T[] = [];
  for (const area of PRIORITY_AREAS) {
    if (chosen.length >= count) break;
    // Ekipmanlı profillerde o bölgenin ekipmanlı hareketi varsa onu tercih et;
    // yoksa program "dambıl ile güç" deyip beş vücut ağırlığı hareketi verirdi.
    const inArea = eligible.filter((exercise) => exercise.area === area && !chosen.includes(exercise));
    if (inArea[0]) chosen.push(rankForProfile(inArea, profile)[0]);
  }
  for (const exercise of rankForProfile(eligible, profile)) {
    if (chosen.length >= count) break;
    if (!chosen.includes(exercise)) chosen.push(exercise);
  }
  return chosen.slice(0, count);
}

/**
 * Ağrı nedeniyle çıkarılan bir hareketin yerine konulacak adayın, plandaki
 * ekipman gerçekliğiyle uyumlu olup olmadığı.
 *
 * Bu olmadan, ağrı bildiren bir kullanıcının ekipmansız programındaki boşluk
 * kişisel plandan gelen bir dambıl hareketiyle doldurulabiliyordu.
 */
export function isReplacementCompatible(replacement: CatalogExercise, plan: CatalogExercise[]): boolean {
  if (replacement.bodyweight) return true;
  const available = new Set(plan.flatMap((exercise) => exercise.requires));
  return replacement.requires.some((requirement) => available.has(requirement));
}
