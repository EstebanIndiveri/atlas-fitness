import { AppError } from '@/types/errors';
import type { WorkoutQueueState } from '@/types/session-queue';
import { completedExerciseIdsForRoutine } from '@/lib/session/progress';
import {
  applyTargetSetsOverrides,
  emptyWorkoutQueue,
  parseStoredQueueJson,
  reconcileWorkoutQueue,
} from '@/lib/session/queue';
import { getRoutineById } from '@/lib/services/routines';

export async function resolveWorkoutQueueState(args: {
  userId: number;
  routineId: number | null;
  sets: readonly { exerciseId: number }[];
  storedQueueJson: string | null;
}): Promise<WorkoutQueueState> {
  const stored = parseStoredQueueJson(args.storedQueueJson);
  if (!args.routineId) {
    return stored ?? emptyWorkoutQueue();
  }

  try {
    const routine = await getRoutineById(args.routineId, args.userId);
    const orderedExerciseIds = routine.exercises.map((item) => item.exerciseId);
    const adaptedRoutine = {
      ...routine,
      exercises: applyTargetSetsOverrides(routine.exercises, stored?.targetSetsOverrides),
    };
    const completedExerciseIds = completedExerciseIdsForRoutine(adaptedRoutine, args.sets);
    return reconcileWorkoutQueue({
      orderedExerciseIds,
      completedExerciseIds,
      previous: stored,
    });
  } catch (error) {
    if (error instanceof AppError && (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')) {
      return stored ?? emptyWorkoutQueue();
    }
    throw error;
  }
}
