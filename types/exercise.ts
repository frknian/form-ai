export interface Exercise {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

export interface ExerciseFilters {
  search?: string;
  muscle?: string;
  equipment?: string;
  level?: string;
  category?: string;
}

export interface AIExerciseContext {
  id: string;
  name: string;
  level?: string;
  equipment?: string;
  primaryMuscles: string[];
  /** İkincil kaslar plan üretimine GÖNDERİLMEZ (token maliyeti). */
  secondaryMuscles?: string[];
  category?: string;
}
