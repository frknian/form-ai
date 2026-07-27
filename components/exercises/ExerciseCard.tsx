"use client";

import { ExerciseAnimation } from "./ExerciseAnimation";
import { translateExerciseLabel } from "@/lib/exercise-translations";
import type { Exercise } from "@/types/exercise";
import { useTranslations } from "@/lib/i18n/translate";
import { useLocale } from "@/lib/i18n/locale";

export function ExerciseCard({ exercise, favorite, onDetail, onFavorite }: { exercise: Exercise; favorite: boolean; onDetail: () => void; onFavorite: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  return <article className="database-exercise-card"><ExerciseAnimation images={exercise.images} name={exercise.name} compact autoplay={false} /><div className="database-card-copy"><div className="database-card-top"><span>{translateExerciseLabel(exercise.primaryMuscles[0], locale, t.exerciseLibrary.general)}</span><button type="button" className={favorite ? "favorite active" : "favorite"} aria-label={favorite ? t.exerciseLibrary.removeFromFavorites(exercise.name) : t.exerciseLibrary.addToFavorites(exercise.name)} aria-pressed={favorite} onClick={onFavorite}>{favorite ? "♥" : "♡"}</button></div><h3>{exercise.name}</h3><div className="exercise-facts"><span>{translateExerciseLabel(exercise.equipment, locale, t.exerciseLibrary.noEquipment)}</span><span>{translateExerciseLabel(exercise.level, locale)}</span></div><button type="button" className="exercise-detail-button" onClick={onDetail}>{t.exerciseLibrary.viewDetails} →</button></div></article>;
}
