export type WorkoutPlanningItem = {
  name: string;
  area: string;
};

const DAY_MS = 86_400_000;

/**
 * Returns a stable day number for the user's local calendar date.
 *
 * Using the raw Unix timestamp would switch the plan at UTC midnight (03:00 in
 * Türkiye) instead of the user's midnight.
 */
export function localPlanDayIndex(now = new Date()) {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

/** Deterministic, profile-specific score that genuinely changes each day. */
export function dailyWorkoutScore(name: string, profileSeed: number, dayIndex: number) {
  const input = `${profileSeed}:${dayIndex}:${name}`;
  let hash = 2_166_136_261;
  for (const character of input) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function preferredWorkoutAreas(goal: "güç" | "kas" | "kilo" | "kondisyon") {
  if (goal === "kilo" || goal === "kondisyon") {
    return ["Kondisyon", "Bacak", "Core", "Göğüs", "Sırt", "Kalça", "Omuz", "Kol"];
  }
  return ["Bacak", "Göğüs", "Sırt", "Core", "Kalça", "Omuz", "Kol", "Kondisyon"];
}

/**
 * Keeps safe user-requested exercises, then builds a balanced full-body
 * combination before filling remaining slots by the daily profile ranking.
 */
export function selectBalancedWorkoutItems<T extends WorkoutPlanningItem>(input: {
  candidates: T[];
  count: number;
  preferredAreas: string[];
  isPinned?: (item: T) => boolean;
  rank?: (item: T) => number;
}) {
  const count = Math.max(1, Math.floor(input.count));
  const isPinned = input.isPinned ?? (() => false);
  const rank = input.rank ?? (() => 0);
  const unique = input.candidates.filter(
    (item, index, list) => list.findIndex((candidate) => candidate.name === item.name) === index,
  );
  const ranked = unique.slice().sort((a, b) => {
    const pinned = Number(isPinned(b)) - Number(isPinned(a));
    return pinned || rank(a) - rank(b) || a.name.localeCompare(b.name, "tr");
  });
  const selected: T[] = [];
  const add = (item: T | undefined) => {
    if (item && selected.length < count && !selected.some((current) => current.name === item.name)) {
      selected.push(item);
    }
  };

  ranked.filter(isPinned).forEach(add);
  for (const area of input.preferredAreas) {
    if (selected.length >= count) break;
    if (selected.some((item) => item.area === area)) continue;
    add(ranked.find((item) => item.area === area));
  }
  ranked.forEach(add);
  return selected;
}
