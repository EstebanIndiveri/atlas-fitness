export type RoutineKind = 'gym' | 'home';

export interface RoutineExerciseItem {
  id: number;
  routineId: number;
  exerciseId: number;
  sortOrder: number;
  targetSets: number;
  targetReps: number;
  exerciseName: string;
  muscleGroup: string;
  instructions: string;
  imageUrl: string | null;
  videoUrl: string | null;
}

export interface RoutineSummary {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  kind: RoutineKind;
  restSeconds: number;
  exercises: RoutineExerciseItem[];
}

export interface NextExerciseSuggestion {
  source: 'gemini' | 'fallback';
  isLast: boolean;
  nextExerciseId: number | null;
  message: string;
}
