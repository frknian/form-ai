export type SetLogInput = {
  exerciseKey: string;
  exerciseName: string;
  completedAt: string;
  weightKg: number | null;
  reps: number | null;
};

export type PersonalRecord = {
  exerciseKey: string;
  exerciseName: string;
  bestWeightKg: number;
  bestReps: number;
  estimatedOneRepMaxKg: number;
  sessionCount: number;
  lastAchievedAt: string;
};

// Epley formülü: tahmini 1RM = ağırlık * (1 + tekrar / 30).
// Tek tekrarlı setlerde 1RM doğrudan kaldırılan ağırlıktır.
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps) || weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

// Ağırlıklı set kayıtlarından hareket bazında kişisel rekorları (en yüksek tahmini 1RM) çıkarır.
export function summarizePersonalRecords(rows: SetLogInput[]): PersonalRecord[] {
  const byExercise = new Map<string, { name: string; best: SetLogInput | null; bestOrm: number; dates: Set<string>; last: string }>();

  for (const row of rows) {
    if (row.weightKg === null || row.weightKg <= 0 || row.reps === null || row.reps <= 0) continue;
    const orm = estimateOneRepMax(row.weightKg, row.reps);
    if (orm <= 0) continue;
    const entry = byExercise.get(row.exerciseKey) || { name: row.exerciseName, best: null, bestOrm: 0, dates: new Set<string>(), last: row.completedAt };
    entry.dates.add(row.completedAt.slice(0, 10));
    if (row.completedAt > entry.last) entry.last = row.completedAt;
    if (orm > entry.bestOrm) {
      entry.bestOrm = orm;
      entry.best = row;
      entry.name = row.exerciseName;
    }
    byExercise.set(row.exerciseKey, entry);
  }

  const records: PersonalRecord[] = [];
  for (const [exerciseKey, entry] of byExercise) {
    if (!entry.best) continue;
    records.push({
      exerciseKey,
      exerciseName: entry.name,
      bestWeightKg: entry.best.weightKg as number,
      bestReps: entry.best.reps as number,
      estimatedOneRepMaxKg: Math.round(entry.bestOrm * 10) / 10,
      sessionCount: entry.dates.size,
      lastAchievedAt: entry.last,
    });
  }

  return records.sort((a, b) => b.estimatedOneRepMaxKg - a.estimatedOneRepMaxKg);
}
