export type WorkoutSetDraft = {
  setNumber: number;
  weightKg: string;
  reps: string;
  durationSeconds: string;
  rpe: string;
  note: string;
  completed: boolean;
};

export type LoggedWorkoutSet = {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  rpe: number | null;
  note: string | null;
};

export type PreviousExercisePerformance = {
  exerciseLogId: string;
  exerciseName: string;
  completedAt: string;
  isBodyweight: boolean;
  sets: LoggedWorkoutSet[];
};

export type CompletedExerciseLog = {
  exerciseId: string | null;
  exerciseName: string;
  exerciseKey: string;
  exerciseOrder: number;
  isBodyweight: boolean;
  sets: LoggedWorkoutSet[];
};

export function exerciseLogKey(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function positiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function createWorkoutSetDrafts(totalSets: number, target: string): WorkoutSetDraft[] {
  const targetValue = String(Math.max(1, Number.parseInt(target, 10) || 10));
  const timed = /sn|saniye/i.test(target);
  return Array.from({ length: Math.max(1, totalSets) }, (_, index) => ({
    setNumber: index + 1,
    weightKg: "",
    reps: timed ? "" : targetValue,
    durationSeconds: timed ? targetValue : "",
    rpe: "",
    note: "",
    completed: false,
  }));
}

export function normalizeWorkoutSet(draft: WorkoutSetDraft): LoggedWorkoutSet | null {
  const weightKg = nonNegativeNumber(draft.weightKg);
  const reps = positiveInteger(draft.reps);
  const durationSeconds = positiveInteger(draft.durationSeconds);
  const rpeValue = positiveInteger(draft.rpe);
  const rpe = rpeValue && rpeValue <= 10 ? rpeValue : null;
  const note = draft.note.trim() || null;
  if (weightKg === null && reps === null && durationSeconds === null && rpe === null && note === null) return null;
  return { setNumber: draft.setNumber, weightKg, reps, durationSeconds, rpe, note };
}

export function buildCompletedExerciseLog(input: {
  exerciseId?: string;
  exerciseName: string;
  exerciseOrder: number;
  isBodyweight: boolean;
  drafts: WorkoutSetDraft[];
}): CompletedExerciseLog | null {
  const sets = input.drafts.filter((draft) => draft.completed).map(normalizeWorkoutSet).filter((set): set is LoggedWorkoutSet => Boolean(set));
  if (!sets.length) return null;
  return {
    exerciseId: input.exerciseId || null,
    exerciseName: input.exerciseName,
    exerciseKey: exerciseLogKey(input.exerciseName),
    exerciseOrder: input.exerciseOrder,
    isBodyweight: input.isBodyweight,
    sets,
  };
}

export function progressionSuggestion(previous: PreviousExercisePerformance | null) {
  if (!previous?.sets.length) return "İlk kaydını tamamladığında burada küçük ve güvenli bir ilerleme önerisi göreceksin.";

  const rpeValues = previous.sets.map((set) => set.rpe).filter((value): value is number => value !== null);
  const averageRpe = rpeValues.length ? rpeValues.reduce((total, value) => total + value, 0) / rpeValues.length : null;
  const topWeight = Math.max(0, ...previous.sets.map((set) => set.weightKg || 0));
  const topReps = Math.max(0, ...previous.sets.map((set) => set.reps || 0));
  const topDuration = Math.max(0, ...previous.sets.map((set) => set.durationSeconds || 0));
  const safety = "Formun bozulursa veya ağrı hissedersen artış yapma.";

  if (averageRpe === null) {
    return `Önceki yük veya tekrarını koru ve bu kez RPE gir; sonraki öneri daha isabetli olur. ${safety}`;
  }
  if (averageRpe >= 9) {
    return `Son kayıt RPE ${averageRpe.toFixed(1)} ile oldukça zordu. Yükü artırma; aynı düzeyi daha kontrollü tamamla. ${safety}`;
  }
  if (averageRpe > 7) {
    return `Son kayıt RPE ${averageRpe.toFixed(1)} ile dengeliydi. Aynı yük ve tekrarları bir kez daha koru. ${safety}`;
  }
  if (topWeight > 0) {
    return `Son kayıt kontrollüydü. Aynı tekrar aralığında en fazla ${(topWeight + 2.5).toLocaleString("tr-TR")} kg deneyebilirsin. ${safety}`;
  }
  if (topDuration > 0) {
    return `Son kayıt kontrollüydü. Süreyi ${topDuration + 5} saniyeye çıkarabilirsin. ${safety}`;
  }
  if (topReps > 0) {
    return `Son kayıt kontrollüydü. Set başına ${topReps + 1}–${topReps + 2} tekrar deneyebilirsin. ${safety}`;
  }
  return `Aynı hareketi benzer RPE ile yeniden tamamla; ölçülebilir tekrar veya süre eklediğinde ilerleme önerisi oluşacak. ${safety}`;
}
