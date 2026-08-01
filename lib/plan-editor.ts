export type EditableWorkout = {
  id?: string;
  name: string;
  english: string;
  area: string;
  sets: string;
  rest: string;
  seconds: number;
  tone: string;
  icon: string;
  level: string;
  instructions: string;
  images?: string[];
  equipment?: string | null;
  secondaryMuscles?: string[];
  category?: string;
  bodyweight?: boolean;
};

export function planPrescription(workout: Pick<EditableWorkout, "sets" | "rest" | "seconds">) {
  const sets = Math.min(8, Math.max(1, Number.parseInt(workout.sets, 10) || 3));
  const restSeconds = Math.min(300, Math.max(15, Number.parseInt(workout.rest, 10) || 60));
  const target = workout.sets.split("·")[1]?.trim() || "10 tekrar";
  const isTimed = /sn|saniye/i.test(target);
  const amount = Math.min(isTimed ? 900 : 100, Math.max(1, Number.parseInt(target, 10) || (isTimed ? workout.seconds : 10)));
  return { sets, restSeconds, target: `${amount} ${isTimed ? "sn" : "tekrar"}`, amount, isTimed };
}

export function updatePlanPrescription(workout: EditableWorkout, change: Partial<{ sets: number; amount: number; restSeconds: number; isTimed: boolean }>): EditableWorkout {
  const current = planPrescription(workout);
  const sets = Math.min(8, Math.max(1, change.sets ?? current.sets));
  const restSeconds = Math.min(300, Math.max(15, change.restSeconds ?? current.restSeconds));
  const isTimed = change.isTimed ?? current.isTimed;
  const amount = Math.min(isTimed ? 900 : 100, Math.max(1, change.amount ?? current.amount));
  return { ...workout, sets: `${sets} set · ${amount} ${isTimed ? "sn" : "tekrar"}`, rest: `${restSeconds} sn dinlenme`, seconds: isTimed ? amount : workout.seconds };
}

export function movePlanWorkout(plan: EditableWorkout[], from: number, direction: -1 | 1) {
  const to = from + direction;
  if (from < 0 || to < 0 || from >= plan.length || to >= plan.length) return plan;
  const next = [...plan];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
