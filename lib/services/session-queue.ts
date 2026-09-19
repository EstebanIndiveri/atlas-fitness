import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workoutQueueMutations, workouts } from '@/lib/db/schema';
import { isUniqueConstraintError } from '@/lib/db/unique-error';
import { completedExerciseIdsForRoutine } from '@/lib/session/progress';
import { applyHold, applySkip } from '@/lib/session/queue';
import { suggestNextExerciseFromRemaining } from '@/lib/services/guided-session';
import { getRoutineById } from '@/lib/services/routines';
import { getWorkoutById } from '@/lib/services/workouts';
import { AppError } from '@/types/errors';
import type {
  SessionQueueAction,
  WorkoutQueueActionResponse,
  WorkoutQueueSetSnapshot,
} from '@/types/session-queue';

export const INACTIVE_WORKOUT_MESSAGE = 'El entrenamiento no está activo.';
export const EXERCISE_NOT_PENDING_MESSAGE = 'El ejercicio no está en la cola pendiente.';
export const MUTATION_CONFLICT_MESSAGE = 'Esta mutación ya se registró con otros datos.';

export interface ApplyWorkoutQueueActionInput {
  workoutId: number;
  userId: number;
  action: SessionQueueAction;
  exerciseId: number;
  clientMutationId: string;
}

export async function applyWorkoutQueueAction(
  input: ApplyWorkoutQueueActionInput,
): Promise<WorkoutQueueActionResponse> {
  const workout = await getWorkoutById(input.workoutId, input.userId);
  if (workout.endedAt) {
    throw new AppError('VALIDATION', INACTIVE_WORKOUT_MESSAGE);
  }
  if (!workout.routineId) {
    throw new AppError('VALIDATION', 'Este entrenamiento no está vinculado a una rutina');
  }

  const existing = await findMutation(input.workoutId, input.action, input.clientMutationId);
  if (existing) {
    return duplicateFromRow(existing, input.exerciseId);
  }

  const queue = workout.queue;
  if (!queue.pendingExerciseIds.includes(input.exerciseId)) {
    throw new AppError('VALIDATION', EXERCISE_NOT_PENDING_MESSAGE);
  }

  const nextQueue =
    input.action === 'skip' ? applySkip(queue, input.exerciseId) : applyHold(queue, input.exerciseId);

  const routine = await getRoutineById(workout.routineId, input.userId);
  const remaining = nextQueue.pendingExerciseIds.flatMap((exerciseId) => {
    const item = routine.exercises.find((exercise) => exercise.exerciseId === exerciseId);
    return item ? [{ id: exerciseId, name: item.exerciseName }] : [];
  });

  const completedIds = completedExerciseIdsForRoutine(routine, workout.sets);
  const lastCompleted = [...routine.exercises]
    .reverse()
    .find((item) => completedIds.includes(item.exerciseId));

  const suggestion = await suggestNextExerciseFromRemaining(
    remaining,
    lastCompleted?.exerciseName ?? null,
  );

  const payload: WorkoutQueueActionResponse = {
    action: input.action,
    clientMutationId: input.clientMutationId,
    duplicate: false,
    queue: nextQueue,
    suggestion,
    sets: toSetSnapshots(workout.sets),
  };

  try {
    await db.transaction(async (tx) => {
      await tx.insert(workoutQueueMutations).values({
        workoutId: input.workoutId,
        action: input.action,
        clientMutationId: input.clientMutationId,
        exerciseId: input.exerciseId,
        responseJson: JSON.stringify(payload),
      });
      await tx
        .update(workouts)
        .set({ queueJson: JSON.stringify(nextQueue) })
        .where(eq(workouts.id, input.workoutId));
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const raced = await findMutation(input.workoutId, input.action, input.clientMutationId);
      if (raced) {
        return duplicateFromRow(raced, input.exerciseId);
      }
    }
    throw error;
  }

  return payload;
}

async function findMutation(
  workoutId: number,
  action: SessionQueueAction,
  clientMutationId: string,
) {
  return db.query.workoutQueueMutations.findFirst({
    where: and(
      eq(workoutQueueMutations.workoutId, workoutId),
      eq(workoutQueueMutations.action, action),
      eq(workoutQueueMutations.clientMutationId, clientMutationId),
    ),
  });
}

function duplicateFromRow(
  row: { exerciseId: number; responseJson: string },
  exerciseId: number,
): WorkoutQueueActionResponse {
  if (row.exerciseId !== exerciseId) {
    throw new AppError('CONFLICT', MUTATION_CONFLICT_MESSAGE);
  }
  const parsed = JSON.parse(row.responseJson) as WorkoutQueueActionResponse;
  return { ...parsed, duplicate: true };
}

function toSetSnapshots(
  sets: readonly {
    id: number;
    exerciseId: number;
    setIndex: number;
    reps: number;
    weightKg: string;
  }[],
): WorkoutQueueSetSnapshot[] {
  return sets.map((set) => ({
    id: set.id,
    exerciseId: set.exerciseId,
    setIndex: set.setIndex,
    reps: set.reps,
    weightKg: set.weightKg,
  }));
}
