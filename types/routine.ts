import type { StreakStats } from '@/types/streak';

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
  isSystem: boolean;
  exercises: RoutineExerciseItem[];
}

export interface RoutineExerciseWrite {
  exerciseId: number;
  sortOrder: number;
  targetSets: number;
  targetReps: number;
}

export interface CreateRoutineInput {
  name: string;
  description?: string | null;
  kind: RoutineKind;
  restSeconds?: number;
  exercises: RoutineExerciseWrite[];
}

export interface UpdateRoutineInput {
  name?: string;
  description?: string | null;
  kind?: RoutineKind;
  restSeconds?: number;
  exercises?: RoutineExerciseWrite[];
}

export type SuggestionSource = 'gemini' | 'fallback';

export interface NextExerciseSuggestion {
  source: SuggestionSource;
  isLast: boolean;
  nextExerciseId: number | null;
  message: string;
}

export type ImprovementDirection = 'up' | 'down' | 'same' | 'none';

export interface ExerciseImprovement {
  exerciseId: number;
  exerciseName: string;
  currentMaxKg: string;
  previousMaxKg: string | null;
  deltaKg: string | null;
  direction: ImprovementDirection;
}

export interface GuidedCloseSummary {
  streak: StreakStats;
  improvements: ExerciseImprovement[];
}

export interface GeminiNextExercisePayload {
  nextExerciseId: number | null;
  isLast: boolean;
  message: string;
}
