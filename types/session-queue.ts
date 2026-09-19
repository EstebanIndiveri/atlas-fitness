import type { NextExerciseSuggestion } from '@/types/routine';

export type SessionQueueAction = 'skip' | 'hold';

export interface WorkoutQueueState {
  pendingExerciseIds: number[];
  skippedExerciseIds: number[];
  heldExerciseIds: number[];
}

export interface WorkoutQueueActionRequest {
  action: SessionQueueAction;
  exerciseId: number;
  clientMutationId: string;
}

export interface WorkoutQueueSetSnapshot {
  id: number;
  exerciseId: number;
  setIndex: number;
  reps: number;
  weightKg: string;
}

export interface WorkoutQueueActionResponse {
  action: SessionQueueAction;
  clientMutationId: string;
  duplicate: boolean;
  queue: WorkoutQueueState;
  suggestion: NextExerciseSuggestion;
  sets?: WorkoutQueueSetSnapshot[];
}
