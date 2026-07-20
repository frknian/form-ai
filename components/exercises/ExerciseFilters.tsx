"use client";

import type { ExerciseFilters as Filters } from "@/types/exercise";
import { translateExerciseLabel } from "@/lib/exercise-translations";

type FilterOptions = { muscles: string[]; equipment: string[]; levels: string[]; categories: string[] };

export function ExerciseFilters({ filters, options, onChange, onClear }: { filters: Filters; options: FilterOptions; onChange: (filters: Filters) => void; onClear: () => void }) {
  const update = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value });
  return <section className="database-filters" aria-label="Egzersiz filtreleri">
    <label className="exercise-search"><span>ARA</span><input value={filters.search || ""} onChange={(event) => update("search", event.target.value)} placeholder="Hareket veya kas ara…" maxLength={100} /></label>
    <label><span>KAS GRUBU</span><select value={filters.muscle || ""} onChange={(event) => update("muscle", event.target.value)}><option value="">Tümü</option>{options.muscles.map((value) => <option value={value} key={value}>{translateExerciseLabel(value)}</option>)}</select></label>
    <label><span>EKİPMAN</span><select value={filters.equipment || ""} onChange={(event) => update("equipment", event.target.value)}><option value="">Tümü</option>{options.equipment.map((value) => <option value={value} key={value}>{translateExerciseLabel(value)}</option>)}</select></label>
    <label><span>SEVİYE</span><select value={filters.level || ""} onChange={(event) => update("level", event.target.value)}><option value="">Tümü</option>{options.levels.map((value) => <option value={value} key={value}>{translateExerciseLabel(value)}</option>)}</select></label>
    <label><span>KATEGORİ</span><select value={filters.category || ""} onChange={(event) => update("category", event.target.value)}><option value="">Tümü</option>{options.categories.map((value) => <option value={value} key={value}>{translateExerciseLabel(value)}</option>)}</select></label>
    <button type="button" className="clear-filters" onClick={onClear}>Filtreleri temizle</button>
  </section>;
}
