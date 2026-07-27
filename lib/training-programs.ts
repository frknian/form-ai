function fold(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const equipmentAliases: Array<[RegExp, string]> = [
  [/\b(dumbell|dumbbell|dambil|dumbil|dumbel)\b/g, "dumbbell"],
  [/\b(kettlebell|girya)\b/g, "kettlebell"],
  [/\b(resistance band|direnc bandi|direnc lastigi|lastik|band)\b/g, "resistance-band"],
  [/\b(bench|sehpa|bank)\b/g, "bench"],
  [/\b(pull up bar|barfiks bari|barfiks|bar)\b/g, "pull-up-bar"],
  [/\b(barbell|halter)\b/g, "barbell"],
  [/\b(cable|kablo)\b/g, "cable"],
  [/\b(machine|makine)\b/g, "machine"],
];

export function normalizeEquipmentInventory(value: string) {
  return equipmentAliases.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), fold(value));
}

export function equipmentMatchesInventory(inventory: string, requirements: string[]) {
  const normalizedInventory = normalizeEquipmentInventory(inventory);
  if (!normalizedInventory) return false;
  return requirements.some((requirement) => {
    const normalizedRequirement = normalizeEquipmentInventory(requirement);
    return Boolean(normalizedRequirement) && (
      normalizedInventory.includes(normalizedRequirement)
      || normalizedRequirement.includes(normalizedInventory)
    );
  });
}

export function exerciseDifficultyScore(name: string) {
  const normalized = fold(name);
  if (/\b(incline|egimli|knee push|diz ustu|glute bridge|dead bug|bird dog|wall|duvar|frog pump|fire hydrant|donkey kick|crunch)\b/.test(normalized)) return 0;
  if (/\b(burpee|bulgarian|pistol|jump|box jump|nordic|dragon flag|handstand|muscle up|one arm|tek kol|hanging|suspended)\b/.test(normalized)) return 2;
  return 1;
}

export function orderExercisesForProgression<T>(items: T[], completedSessions: number, getName: (item: T) => string) {
  const beginnerPhase = completedSessions < 3;
  const eligible = beginnerPhase
    ? items.filter((item) => exerciseDifficultyScore(getName(item)) < 2)
    : items;
  const source = eligible.length >= 3 ? eligible : items;
  return [...source].sort((a, b) => exerciseDifficultyScore(getName(a)) - exerciseDifficultyScore(getName(b)));
}
