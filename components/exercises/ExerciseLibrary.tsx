"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ExerciseCard } from "./ExerciseCard";
import { ExerciseDetail } from "./ExerciseDetail";
import { ExerciseFilters } from "./ExerciseFilters";
import { filterExercises, getAllExercises, getExerciseFilterOptions } from "@/lib/exercise-service";
import type { Exercise, ExerciseFilters as Filters } from "@/types/exercise";

export function ExerciseLibrary({ onOpenWorkout, onAddWorkout }: { onOpenWorkout: (exercise: Exercise) => void; onAddWorkout: (exercise: Exercise) => void }) {
  const [filters, setFilters] = useState<Filters>({});
  const [visibleCount, setVisibleCount] = useState(24);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [addedName, setAddedName] = useState("");
  const [isPending, startTransition] = useTransition();
  const toastTimer = useRef<number | null>(null);
  const options = useMemo(() => getExerciseFilterOptions(), []);
  const exercises = useMemo(() => filterExercises(filters), [filters]);
  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); }, []);
  const toggleFavorite = (id: string) => setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const addWorkout = (exercise: Exercise) => { onAddWorkout(exercise); setAddedName(exercise.name); if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setAddedName(""), 2200); };
  const updateFilters = (next: Filters) => startTransition(() => { setFilters(next); setVisibleCount(24); });

  return <div className="subview database-library"><div className="eyebrow">HAREKET KÜTÜPHANESİ</div><h1>Hareketi gör,<br /><em>formunu öğren.</em></h1><p className="lead">{getAllExercises().length} egzersizi gerçek başlangıç ve bitiş kareleriyle incele; kas, ekipman, seviye ve kategoriye göre filtrele.</p><ExerciseFilters filters={filters} options={options} onChange={updateFilters} onClear={() => updateFilters({})} /><div className="library-result-row"><strong>{exercises.length} sonuç</strong><span>{isPending ? "Filtreleniyor…" : "Yerel hareket görselleri"}</span></div>{exercises.length ? <div className="database-exercise-grid">{exercises.slice(0, visibleCount).map((exercise) => <ExerciseCard exercise={exercise} favorite={favorites.includes(exercise.id)} onDetail={() => setSelected(exercise)} onFavorite={() => toggleFavorite(exercise.id)} key={exercise.id} />)}</div> : <div className="library-empty"><strong>Uygun egzersiz bulunamadı.</strong><p>Arama metnini veya filtrelerden birini değiştir.</p><button type="button" onClick={() => updateFilters({})}>Filtreleri temizle</button></div>}{visibleCount < exercises.length && <button type="button" className="load-exercises" onClick={() => setVisibleCount((count) => count + 24)}>24 hareket daha göster →</button>}{selected && <ExerciseDetail exercise={selected} favorite={favorites.includes(selected.id)} onClose={() => setSelected(null)} onFavorite={() => toggleFavorite(selected.id)} onAdd={() => addWorkout(selected)} onOpen={() => onOpenWorkout(selected)} />}{addedName && <div className="exercise-added" role="status">✓ {addedName} antrenmanına eklendi</div>}</div>;
}
