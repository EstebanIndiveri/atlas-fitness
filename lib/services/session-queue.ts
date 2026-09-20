import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workoutQueueMutations, workouts } from '@/lib/db/schema';
import { isSqliteBusyError, isUniqueConstraintError } from '@/lib/db/unique-error';
import { completedExerciseIdsForRoutine } from '@/lib/session/progress';
import { applyHold, applySkip } from '@/lib/session/queue';
import { suggestNextExerciseFromRemaining } from '@/lib/services/guided-session';
import { getRoutineById } from '@/lib/services/routines';
import { parseStoredActionResponse } from '@/lib/services/session-queue-response';
import { getWorkoutById } from '@/lib/services/workouts';
import { AppError } from '@/types/errors';
import type { WorkoutWithSets } from '@/lib/services/workouts';
import type { RoutineSummary } from '@/types/routine';
import type {
  SessionQueueAction,
  WorkoutQueueActionResponse,
  WorkoutQueueSetSnapshot,
  WorkoutQueueState,
} from '@/types/session-queue';

export const INACTIVE_WORKOUT_MESSAGE = 'El entrenamiento no está activo.';
export const EXERCISE_NOT_PENDING_MESSAGE = 'El ejercicio no está en la cola pendiente.';
export const MUTATION_CONFLICT_MESSAGE = 'Esta mutación ya se registró con otros datos.';
export const QUEUE_CONCURRENT_UPDATE_MESSAGE =
  'No se pudo actualizar la cola. Probá de nuevo.';

const MAX_QUEUE_ACTION_RETRIES = 3;
const workoutQueueWriteLocks = new Map<number, Promise<void>>();

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
  const existing = await findMutation(input.workoutId, input.action, input.clientMutationId);
  if (existing) {
    await getWorkoutById(input.workoutId, input.userId);
    return duplicateFromRow(existing, input.exerciseId);
  }

  for (let attempt = 0; attempt < MAX_QUEUE_ACTION_RETRIES; attempt += 1) {
    const { workout, routine } = await loadActionContext(input);
    const nextQueue =
      input.action === 'skip'
        ? applySkip(workout.queue, input.exerciseId)
        : applyHold(workout.queue, input.exerciseId);
    const payload = await buildActionResponse(input, workout, routine, nextQueue);

    try {
      await withWorkoutQueueWriteLock(input.workoutId, () =>
        persistQueueMutation(input, workout.queueVersion, nextQueue, payload),
      );
      return payload;
    } catch (error) {
      if (error instanceof QueueVersionConflictError || isSqliteBusyError(error)) {
        continue;
      }
      if (isUniqueConstraintError(error)) {
        const raced = await findMutation(input.workoutId, input.action, input.clientMutationId);
        if (raced) {
          return duplicateFromRow(raced, input.exerciseId);
        }
      }
      throw error;
    }
  }

  throw new AppError('CONFLICT', QUEUE_CONCURRENT_UPDATE_MESSAGE);
}

async function withWorkoutQueueWriteLock<T>(
  workoutId: number,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = workoutQueueWriteLocks.get(workoutId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(operation);
  const lock = run.then(
    () => undefined,
    () => undefined,
  );
  workoutQueueWriteLocks.set(workoutId, lock);

  try {
    return await run;
  } finally {
    if (workoutQueueWriteLocks.get(workoutId) === lock) {
      workoutQueueWriteLocks.delete(workoutId);
    }
  }
}

async function loadActionContext(input: ApplyWorkoutQueueActionInput): Promise<{
  workout: WorkoutWithSets;
  routine: RoutineSummary;
}> {
  const workout = await getWorkoutById(input.workoutId, input.userId);
  if (workout.endedAt) {
    throw new AppError('VALIDATION', INACTIVE_WORKOUT_MESSAGE);
  }
  if (!workout.routineId) {
    throw new AppError('VALIDATION', 'Este entrenamiento no está vinculado a una rutina');
  }
  if (!workout.queue.pendingExerciseIds.includes(input.exerciseId)) {
    throw new AppError('VALIDATION', EXERCISE_NOT_PENDING_MESSAGE);
  }

  const routine = await getRoutineById(workout.routineId, input.userId);
  return { workout, routine };
}

async function buildActionResponse(
  input: ApplyWorkoutQueueActionInput,
  workout: WorkoutWithSets,
  routine: RoutineSummary,
  nextQueue: WorkoutQueueState,
): Promise<WorkoutQueueActionResponse> {
  const pendingForSuggestion =
    input.action === 'hold'
      ? nextQueue.pendingExerciseIds.filter((exerciseId) => exerciseId !== input.exerciseId)
      : nextQueue.pendingExerciseIds;
  const remaining = pendingForSuggestion.flatMap((exerciseId) => {
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

  return {
    action: input.action,
    clientMutationId: input.clientMutationId,
    duplicate: false,
    queue: nextQueue,
    suggestion,
    sets: toSetSnapshots(workout.sets),
  };
}

async function persistQueueMutation(
  input: ApplyWorkoutQueueActionInput,
  expectedQueueVersion: number,
  nextQueue: WorkoutQueueState,
  payload: WorkoutQueueActionResponse,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(workoutQueueMutations).values({
      workoutId: input.workoutId,
      action: input.action,
      clientMutationId: input.clientMutationId,
      exerciseId: input.exerciseId,
      responseJson: JSON.stringify(payload),
    });
    const updated = await tx
      .update(workouts)
      .set({
        queueJson: JSON.stringify(nextQueue),
        queueVersion: expectedQueueVersion + 1,
      })
      .where(and(eq(workouts.id, input.workoutId), eq(workouts.queueVersion, expectedQueueVersion)))
      .returning({ id: workouts.id });

    if (updated.length === 0) {
      throw new QueueVersionConflictError();
    }
  });
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
  const parsed = parseStoredActionResponse(row.responseJson);
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

class QueueVersionConflictError extends Error {
  constructor() {
    super('Workout queue version changed during mutation');
    this.name = 'QueueVersionConflictError';
  }
}
