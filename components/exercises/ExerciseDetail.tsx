"use client";

import { useEffect, useRef } from "react";
import { ExerciseAnimation } from "./ExerciseAnimation";
import { translateExerciseLabel, translateExerciseList, turkishExerciseInstructions } from "@/lib/exercise-translations";
import type { Exercise } from "@/types/exercise";
import { useTranslations } from "@/lib/i18n/translate";
import { useLocale } from "@/lib/i18n/locale";

export function ExerciseDetail({ exercise, favorite, onClose, onFavorite, onAdd, onOpen }: { exercise: Exercise; favorite: boolean; onClose: () => void; onFavorite: () => void; onAdd: () => void; onOpen: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      previousFocus?.focus();
    };
  }, [onClose]);
  const instructions = turkishExerciseInstructions(exercise, locale);
  return <div className="exercise-detail-overlay" role="dialog" aria-modal="true" aria-labelledby="exercise-detail-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><article className="exercise-detail" ref={dialogRef}><button type="button" className="detail-close" aria-label={t.exerciseLibrary.closeDetail} onClick={onClose} autoFocus>×</button><ExerciseAnimation images={exercise.images} name={exercise.name} intervalMs={800} /><div className="detail-copy"><div className="eyebrow">{t.exerciseLibrary.databaseEyebrow}</div><h2 id="exercise-detail-title">{exercise.name}</h2><div className="detail-tags"><span>{translateExerciseList(exercise.primaryMuscles, locale) || t.exerciseLibrary.general}</span><span>{translateExerciseLabel(exercise.equipment, locale)}</span><span>{translateExerciseLabel(exercise.level, locale)}</span></div><div className="exercise-metadata"><div><span>{t.exerciseLibrary.secondaryMuscles}</span><strong>{translateExerciseList(exercise.secondaryMuscles, locale) || t.exerciseLibrary.none}</strong></div><div><span>{t.exerciseLibrary.category2}</span><strong>{translateExerciseLabel(exercise.category, locale)}</strong></div><div><span>{t.exerciseLibrary.mechanic}</span><strong>{translateExerciseLabel(exercise.mechanic, locale)}</strong></div><div><span>{t.exerciseLibrary.forceType}</span><strong>{translateExerciseLabel(exercise.force, locale)}</strong></div></div><section className="detail-instructions"><h3>{t.exerciseLibrary.stepByStep}</h3><ol>{instructions.map((instruction, index) => <li key={`${exercise.id}-${index}`}>{instruction}</li>)}</ol></section><div className="detail-actions"><button type="button" className="detail-open" onClick={onOpen}>{t.exerciseLibrary.openExercise}</button><button type="button" className="detail-add" onClick={onAdd}>{t.exerciseLibrary.addToMyWorkout}</button><button type="button" className={favorite ? "detail-favorite active" : "detail-favorite"} aria-pressed={favorite} onClick={onFavorite}>{favorite ? t.exerciseLibrary.inMyFavorites : t.exerciseLibrary.addToFavoritesLong}</button></div></div></article></div>;
}
