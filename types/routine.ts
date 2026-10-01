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

/**
 * Safe post-close facts only (v0.12).
 *
 * A bare `weight_kg` cannot prove an improvement (it may be external load,
 * added load, assistance or a bodyweight sentinel, and the previous session may
 * be open/incompatible), so v0.12 exposes no max-weight delta and no
 * `Σ(weight_kg × reps)` "volume". Any future PR shown after close must come
 * from the versioned progression read model, never from this summary.
 */
export interface GuidedCloseStats {
  durationMinutes: number | null;
  completedSets: number;
}

export interface GuidedCloseSummary {
  streak: StreakStats;
  stats: GuidedCloseStats;
}

export interface GeminiNextExercisePayload {
  nextExerciseId: number | null;
  isLast: boolean;
  message: string;
}
