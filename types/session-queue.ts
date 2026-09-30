import type { NextExerciseSuggestion } from '@/types/routine';

export type SessionQueueAction = 'skip' | 'hold';

export interface WorkoutQueueState {
  pendingExerciseIds: number[];
  skippedExerciseIds: number[];
  heldExerciseIds: number[];
  targetSetsOverrides?: Record<number, number>;
}

export interface WorkoutQueueActionRequest {
  action: SessionQueueAction;
  exerciseId: number;
  clientMutationId: string;
}

/**
 * A set moved between the API and clients (queue action retry snapshots).
 *
 * The declared semantic tuple travels with the raw amount so no downstream
 * consumer has to infer meaning from a bare `weightKg`; a legacy row carries an
 * all-null tuple and stays explicitly unknown.
 */
export interface WorkoutQueueSetSnapshot {
  id: number;
  exerciseId: number;
  setIndex: number;
  reps: number;
  weightKg: string;
  semanticCaptureVersion: number | null;
  loadMode: string | null;
  amountBasis: string | null;
  side: string | null;
  setPurpose: string | null;
  repCountBasis: string | null;
}

export interface WorkoutQueueActionResponse {
  action: SessionQueueAction;
  clientMutationId: string;
  duplicate: boolean;
  queue: WorkoutQueueState;
  suggestion: NextExerciseSuggestion;
  sets?: WorkoutQueueSetSnapshot[];
}
