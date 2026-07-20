import exerciseData from "../data/exercises.json" with { type: "json" };
import { translateExerciseLabel } from "./exercise-translations.ts";
import type { AIExerciseContext, Exercise, ExerciseFilters } from "@/types/exercise";

const safeText = (value: unknown, fallback = "", maxLength = 300) => typeof value === "string" ? value.trim().slice(0, maxLength) : fallback;
const safeList = (value: unknown, limit = 20, maxLength = 300) => Array.isArray(value) ? value.map((item) => safeText(item, "", maxLength)).filter(Boolean).slice(0, limit) : [];
const safeImage = (value: unknown) => typeof value === "string" && /^\/exercise-images\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(value) ? value : null;
const fold = (value: string) => value.toLocaleLowerCase("en-US").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export function normalizeExercise(value: unknown): Exercise | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const id = safeText(item.id).replace(/[^a-zA-Z0-9_-]/g, "");
  const name = safeText(item.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    force: safeText(item.force) || null,
    level: safeText(item.level, "beginner"),
    mechanic: safeText(item.mechanic) || null,
    equipment: safeText(item.equipment) || null,
    primaryMuscles: safeList(item.primaryMuscles),
    secondaryMuscles: safeList(item.secondaryMuscles),
    instructions: safeList(item.instructions, 12, 1200),
    category: safeText(item.category, "strength"),
    images: safeList(item.images, 4).map(safeImage).filter((image): image is string => Boolean(image)),
  };
}

const exercises = Object.freeze((exerciseData as unknown[]).map(normalizeExercise).filter((exercise): exercise is Exercise => Boolean(exercise)));
const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

export const getAllExercises = () => [...exercises];
export const getExerciseById = (id: string) => exerciseById.get(id.replace(/[^a-zA-Z0-9_-]/g, "")) ?? null;

export function searchExercises(query: string) {
  const normalizedQuery = fold(query).slice(0, 100);
  if (!normalizedQuery) return getAllExercises();
  return exercises.filter((exercise) => fold([exercise.name, ...exercise.primaryMuscles, ...exercise.secondaryMuscles, exercise.equipment || "", ...exercise.primaryMuscles.map((item) => translateExerciseLabel(item)), ...exercise.secondaryMuscles.map((item) => translateExerciseLabel(item)), translateExerciseLabel(exercise.equipment)].join(" ")).includes(normalizedQuery));
}

export function filterExercises(filters: ExerciseFilters = {}) {
  const search = fold(filters.search || "").slice(0, 100);
  const muscle = fold(filters.muscle || "");
  const equipment = fold(filters.equipment || "");
  const level = fold(filters.level || "");
  const category = fold(filters.category || "");
  return exercises.filter((exercise) => {
    const searchable = fold([exercise.name, ...exercise.primaryMuscles, ...exercise.secondaryMuscles, exercise.equipment || "", ...exercise.primaryMuscles.map((item) => translateExerciseLabel(item)), ...exercise.secondaryMuscles.map((item) => translateExerciseLabel(item)), translateExerciseLabel(exercise.equipment)].join(" "));
    return (!search || searchable.includes(search))
      && (!muscle || exercise.primaryMuscles.some((item) => fold(item) === muscle) || exercise.secondaryMuscles.some((item) => fold(item) === muscle))
      && (!equipment || fold(exercise.equipment || "none") === equipment)
      && (!level || fold(exercise.level) === level)
      && (!category || fold(exercise.category) === category);
  });
}

export const getExercisesByMuscle = (muscle: string) => filterExercises({ muscle });
export const getExercisesByEquipment = (equipment: string) => filterExercises({ equipment });
export const getExercisesByLevel = (level: string) => filterExercises({ level });

export function getExercisesForAI(filters: ExerciseFilters = {}): AIExerciseContext[] {
  return filterExercises(filters).map(({ id, name, level, equipment, primaryMuscles, secondaryMuscles, category }) => ({ id, name, level, equipment: equipment || undefined, primaryMuscles, secondaryMuscles, category }));
}

export function getExerciseFilterOptions() {
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return {
    muscles: unique(exercises.flatMap((exercise) => [...exercise.primaryMuscles, ...exercise.secondaryMuscles])),
    equipment: unique(exercises.map((exercise) => exercise.equipment || "none")),
    levels: unique(exercises.map((exercise) => exercise.level)),
    categories: unique(exercises.map((exercise) => exercise.category)),
  };
}
