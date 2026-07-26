"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ExerciseCard } from "./ExerciseCard";
import { ExerciseDetail } from "./ExerciseDetail";
import { ExerciseFilters } from "./ExerciseFilters";
import { filterExercises, getAllExercises, getExerciseFilterOptions } from "@/lib/exercise-service";
import type { Exercise, ExerciseFilters as Filters } from "@/types/exercise";
import { useTranslations } from "@/lib/i18n/translate";

export function ExerciseLibrary({ onOpenWorkout, onAddWorkout }: { onOpenWorkout: (exercise: Exercise) => void; onAddWorkout: (exercise: Exercise) => void }) {
  const t = useTranslations();
  const [filters, setFilters] = useState<Filters>({});
  const [visibleCount, setVisibleCount] = useState(24);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [addedName, setAddedName] = useState("");
  const [isPending, startTransition] = useTransition();
  const toastTimer = useRef<number | null>(null);
  const options = useMemo(() => getExerciseFilterOptions(filters), [filters]);
  const exercises = useMemo(() => filterExercises(filters), [filters]);
  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); }, []);
  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const addWorkout = (exercise: Exercise) => { onAddWorkout(exercise); setAddedName(exercise.name); if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setAddedName(""), 2200); };
  // Yeni seçim, hâlâ seçili duran başka bir filtreyi veri dışı bırakabilir
  // (ör. "göğüs" seçilince "kettlebell" hareketi kalmaz). Bu durumda geçersiz
  // kalan filtreyi sessizce temizleyip boş sonuç ekranını önlüyoruz.
  const updateFilters = (next: Filters) => startTransition(() => {
    const available = getExerciseFilterOptions(next);
    const pruned: Filters = { ...next };
    if (pruned.muscle && !available.muscles.includes(pruned.muscle)) delete pruned.muscle;
    if (pruned.equipment && !available.equipment.includes(pruned.equipment)) delete pruned.equipment;
    if (pruned.level && !available.levels.includes(pruned.level)) delete pruned.level;
    if (pruned.category && !available.categories.includes(pruned.category)) delete pruned.category;
    setFilters(pruned);
    setVisibleCount(24);
  });

  return <div className="subview database-library"><div className="eyebrow">{t.exerciseLibrary.eyebrow}</div><h1>{t.exerciseLibrary.title1}<br /><em>{t.exerciseLibrary.title2}</em></h1><p className="lead">{t.exerciseLibrary.lead(getAllExercises().length)}</p><ExerciseFilters filters={filters} options={options} onChange={updateFilters} onClear={() => updateFilters({})} /><div className="library-result-row"><strong>{t.exerciseLibrary.resultCount(exercises.length)}</strong><span>{isPending ? t.exerciseLibrary.filtering : t.exerciseLibrary.localImages}</span></div>{exercises.length ? <div className="database-exercise-grid">{exercises.slice(0, visibleCount).map((exercise) => <ExerciseCard exercise={exercise} favorite={favorites.includes(exercise.id)} onDetail={() => setSelected(exercise)} onFavorite={() => toggleFavorite(exercise.id)} key={exercise.id} />)}</div> : <div className="library-empty"><strong>{t.exerciseLibrary.noExercisesFound}</strong><p>{t.exerciseLibrary.tryDifferentFilters}</p><button type="button" onClick={() => updateFilters({})}>{t.exerciseLibrary.clearFilters}</button></div>}{visibleCount < exercises.length && <button type="button" className="load-exercises" onClick={() => setVisibleCount((count) => count + 24)}>{t.exerciseLibrary.loadMore}</button>}{selected && <ExerciseDetail exercise={selected} favorite={favorites.includes(selected.id)} onClose={() => setSelected(null)} onFavorite={() => toggleFavorite(selected.id)} onAdd={() => addWorkout(selected)} onOpen={() => onOpenWorkout(selected)} />}{addedName && <div className="exercise-added" role="status">{t.exerciseLibrary.addedToWorkout(addedName)}</div>}</div>;
}
