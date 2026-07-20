"use client";

import { ExerciseAnimation } from "./ExerciseAnimation";
import { translateExerciseLabel } from "@/lib/exercise-translations";
import type { Exercise } from "@/types/exercise";

export function ExerciseCard({ exercise, favorite, onDetail, onFavorite }: { exercise: Exercise; favorite: boolean; onDetail: () => void; onFavorite: () => void }) {
  return <article className="database-exercise-card"><ExerciseAnimation images={exercise.images} name={exercise.name} compact /><div className="database-card-copy"><div className="database-card-top"><span>{translateExerciseLabel(exercise.primaryMuscles[0], "Genel")}</span><button type="button" className={favorite ? "favorite active" : "favorite"} aria-label={favorite ? `${exercise.name} favorilerden çıkar` : `${exercise.name} favorilere ekle`} aria-pressed={favorite} onClick={onFavorite}>{favorite ? "♥" : "♡"}</button></div><h3>{exercise.name}</h3><div className="exercise-facts"><span>{translateExerciseLabel(exercise.equipment, "Ekipmansız")}</span><span>{translateExerciseLabel(exercise.level)}</span></div><button type="button" className="exercise-detail-button" onClick={onDetail}>Detayları görüntüle →</button></div></article>;
}
