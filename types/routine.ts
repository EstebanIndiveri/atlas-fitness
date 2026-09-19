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
<<<<<<< HEAD
  isSystem: boolean;
  exercises: RoutineExerciseItem[];
}

export interface RoutineExerciseWrite {
=======
  /** Present when BE includes catalog ownership on the DTO. */
  isSystem?: boolean;
  exercises: RoutineExerciseItem[];
}

export interface RoutineWriteExercise {
>>>>>>> 6723674 (feat(fe): routine editor form with media preview)
  exerciseId: number;
  sortOrder: number;
  targetSets: number;
  targetReps: number;
}

<<<<<<< HEAD
export interface CreateRoutineInput {
=======
export interface RoutineWriteInput {
>>>>>>> 6723674 (feat(fe): routine editor form with media preview)
  name: string;
  description?: string | null;
  kind: RoutineKind;
  restSeconds?: number;
<<<<<<< HEAD
  exercises: RoutineExerciseWrite[];
}

export interface UpdateRoutineInput {
  name?: string;
  description?: string | null;
  kind?: RoutineKind;
  restSeconds?: number;
  exercises?: RoutineExerciseWrite[];
=======
  exercises: RoutineWriteExercise[];
>>>>>>> 6723674 (feat(fe): routine editor form with media preview)
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
