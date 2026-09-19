import { SESSION_COPY } from '@/lib/copy/session';
import { getWorkoutById } from '@/lib/services/workouts';
import { AppError } from '@/types/errors';
import type { SessionQueueAction, WorkoutQueueActionResponse } from '@/types/session-queue';

const INACTIVE_WORKOUT_MESSAGE = 'El entrenamiento no está activo.';

export interface ApplyWorkoutQueueActionInput {
  workoutId: number;
  userId: number;
  action: SessionQueueAction;
  exerciseId: number;
  clientMutationId: string;
}

/**
 * Skip/hold for an active guided workout.
 * WIP: queue persistence, idempotency store, and remaining-based suggestion land in this PR.
 */
export async function applyWorkoutQueueAction(
  input: ApplyWorkoutQueueActionInput,
): Promise<WorkoutQueueActionResponse> {
  const workout = await getWorkoutById(input.workoutId, input.userId);
  if (workout.endedAt) {
    throw new AppError('VALIDATION', INACTIVE_WORKOUT_MESSAGE);
  }

  return {
    action: input.action,
    clientMutationId: input.clientMutationId,
    duplicate: false,
    queue: {
      pendingExerciseIds: [],
      skippedExerciseIds: [],
      heldExerciseIds: [],
    },
    suggestion: {
      source: 'fallback',
      isLast: true,
      nextExerciseId: null,
      message: SESSION_COPY.lastExerciseDone,
    },
    sets: workout.sets.map((set) => ({
      id: set.id,
      exerciseId: set.exerciseId,
      setIndex: set.setIndex,
      reps: set.reps,
      weightKg: set.weightKg,
    })),
  };
}
