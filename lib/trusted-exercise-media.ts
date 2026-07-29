import mediaByExercise from "../data/plan-exercise-media.json" with { type: "json" };

/**
 * These frame pairs are packaged locally from Free Exercise DB. Its Unlicense
 * is kept in data/FREE_EXERCISE_DB_LICENSE.md, so no runtime media request or
 * unverified third-party image is required.
 */
function key(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function trustedExerciseMedia(name: string, englishName = "") {
  const mapping = mediaByExercise[key(name) as keyof typeof mediaByExercise]
    || mediaByExercise[key(englishName) as keyof typeof mediaByExercise];
  return mapping?.images || [];
}

export const trustedExerciseMediaLicense = "Free Exercise DB · Unlicense · yerel medya";
