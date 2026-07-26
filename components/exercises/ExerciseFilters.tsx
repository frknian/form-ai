"use client";

import type { ExerciseFilters as Filters } from "@/types/exercise";
import { translateExerciseLabel } from "@/lib/exercise-translations";
import { useTranslations } from "@/lib/i18n/translate";
import { useLocale } from "@/lib/i18n/locale";

type FilterOptions = { muscles: string[]; equipment: string[]; levels: string[]; categories: string[] };

export function ExerciseFilters({ filters, options, onChange, onClear }: { filters: Filters; options: FilterOptions; onChange: (filters: Filters) => void; onClear: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const update = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value });
  return <section className="database-filters" aria-label={t.exerciseLibrary.filtersAriaLabel}>
    <label className="exercise-search"><span>{t.exerciseLibrary.search}</span><input value={filters.search || ""} onChange={(event) => update("search", event.target.value)} placeholder={t.exerciseLibrary.searchPlaceholder} maxLength={100} /></label>
    <label><span>{t.exerciseLibrary.muscleGroup}</span><select value={filters.muscle || ""} onChange={(event) => update("muscle", event.target.value)}><option value="">{t.exerciseLibrary.all}</option>{options.muscles.map((value) => <option value={value} key={value}>{translateExerciseLabel(value, locale)}</option>)}</select></label>
    <label><span>{t.exerciseLibrary.equipment}</span><select value={filters.equipment || ""} onChange={(event) => update("equipment", event.target.value)}><option value="">{t.exerciseLibrary.all}</option>{options.equipment.map((value) => <option value={value} key={value}>{translateExerciseLabel(value, locale)}</option>)}</select></label>
    <label><span>{t.exerciseLibrary.level}</span><select value={filters.level || ""} onChange={(event) => update("level", event.target.value)}><option value="">{t.exerciseLibrary.all}</option>{options.levels.map((value) => <option value={value} key={value}>{translateExerciseLabel(value, locale)}</option>)}</select></label>
    <label><span>{t.exerciseLibrary.category}</span><select value={filters.category || ""} onChange={(event) => update("category", event.target.value)}><option value="">{t.exerciseLibrary.all}</option>{options.categories.map((value) => <option value={value} key={value}>{translateExerciseLabel(value, locale)}</option>)}</select></label>
    <button type="button" className="clear-filters" onClick={onClear}>{t.exerciseLibrary.clearFilters}</button>
  </section>;
}
