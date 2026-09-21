import { eq, and, isNull, desc } from 'drizzle-orm';
import { canAccessCatalogItem } from '@/lib/auth/ownership';
import { db } from '@/lib/db/client';
import { routines, workouts, workoutSets } from '@/lib/db/schema';
import { isSqliteBusyError, isUniqueConstraintError } from '@/lib/db/unique-error';
import { buildWorkoutQueue } from '@/lib/session/queue';
import { getRoutineById } from '@/lib/services/routines';
import { updateStreakFromActivity } from '@/lib/services/streaks';
import { resolveWorkoutQueueState } from '@/lib/services/workout-queue';
import { AppError } from '@/types/errors';
import type { Workout, WorkoutSet } from '@/lib/db/schema';
import type { WorkoutQueueState } from '@/types/session-queue';

export type WorkoutWithSets = Omit<Workout, 'queueJson'> & {
  sets: WorkoutSet[];
  queue: WorkoutQueueState;
};

export interface UpdateWorkoutInput {
  endedAt?: Date;
  note?: string | null;
  mood?: number | null;
}

async function resolveRoutineId(
  userId: number,
  routineId?: number | null,
): Promise<number | null> {
  if (routineId === undefined || routineId === null) {
    return null;
  }

  const routine = await db.query.routines.findFirst({
    where: eq(routines.id, routineId),
  });

  if (!routine || routine.deletedAt || !canAccessCatalogItem(routine, userId)) {
    throw new AppError('VALIDATION', 'Rutina no válida');
  }

  return routineId;
}

async function findActiveWorkoutRow(userId: number): Promise<Workout | undefined> {
  return db.query.workouts.findFirst({
    where: and(
      eq(workouts.userId, userId),
      isNull(workouts.endedAt),
      isNull(workouts.deletedAt),
    ),
  });
}

/**
 * Options for creating a workout.
 */
export interface CreateWorkoutOptions {
  /**
   * Exercise ids to pre-skip in the initial queue (e.g. removed by a Coach Atlas
   * adaptation). Requires a routineId; ignored for free workouts.
   */
  skippedExerciseIds?: readonly number[];
}

async function buildInitialQueueJson(
  userId: number,
  routineId: number,
  skippedExerciseIds: readonly number[],
): Promise<string | null> {
  const uniqueSkipped = Array.from(new Set(skippedExerciseIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (uniqueSkipped.length === 0) {
    return null;
  }

  const routine = await getRoutineById(routineId, userId);
  const orderedExerciseIds = routine.exercises.map((item) => item.exerciseId);
  const queue = buildWorkoutQueue({
    orderedExerciseIds,
    completedExerciseIds: [],
    skippedExerciseIds: uniqueSkipped.filter((id) => orderedExerciseIds.includes(id)),
  });
  if (queue.skippedExerciseIds.length === 0) {
    return null;
  }

  return JSON.stringify(queue);
}

/**
 * Creates a new workout for a user. At most one active (not ended, not deleted) workout per user.
 * Atomicity comes from the partial unique index `workouts_user_id_active_unique`.
 *
 * @param userId Owner of the workout.
 * @param routineId Optional guided-session routine id.
 * @param options Optional creation options (e.g. Coach Atlas pre-skipped exercises).
 * @returns The persisted workout row.
 * @throws {AppError} VALIDATION for an invalid routine, CONFLICT when another workout is active.
 */
export async function createWorkout(
  userId: number,
  routineId?: number | null,
  options?: CreateWorkoutOptions,
): Promise<Workout> {
  const resolvedRoutineId = await resolveRoutineId(userId, routineId);
  const queueJson =
    resolvedRoutineId !== null && options?.skippedExerciseIds && options.skippedExerciseIds.length > 0
      ? await buildInitialQueueJson(userId, resolvedRoutineId, options.skippedExerciseIds)
      : null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = await findActiveWorkoutRow(userId);
    if (existing) {
      throw new AppError('CONFLICT', 'Ya tienes un entrenamiento en curso');
    }

    try {
      const [workout] = await db
        .insert(workouts)
        .values({
          userId,
          routineId: resolvedRoutineId,
          startedAt: new Date(),
          ...(queueJson !== null ? { queueJson } : {}),
        })
        .returning();

      return workout;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError('CONFLICT', 'Ya tienes un entrenamiento en curso');
      }
      if (isSqliteBusyError(error) && attempt < 2) {
        continue;
      }
      throw error;
    }
  }

  throw new AppError('CONFLICT', 'Ya tienes un entrenamiento en curso');
}

/**
 * Lists all workouts for a user, excluding soft deleted
 */
export async function listWorkouts(userId: number): Promise<Workout[]> {
  return db.query.workouts.findMany({
    where: and(eq(workouts.userId, userId), isNull(workouts.deletedAt)),
    orderBy: desc(workouts.startedAt),
  });
}

/**
 * Gets a workout by ID with its sets, excluding soft deleted sets
 */
export async function getWorkoutById(
  workoutId: number,
  userId: number
): Promise<WorkoutWithSets> {
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
  });

  if (!workout || workout.deletedAt) {
    throw new AppError('NOT_FOUND', 'Entrenamiento no encontrado');
  }

  if (workout.userId !== userId) {
    throw new AppError('FORBIDDEN', 'No tienes permiso para acceder a este entrenamiento');
  }

  const sets = await db.query.workoutSets.findMany({
    where: and(eq(workoutSets.workoutId, workoutId), isNull(workoutSets.deletedAt)),
    orderBy: (workoutSets, { asc }) => [asc(workoutSets.setIndex)],
  });

  const { queueJson, ...rest } = workout;
  const queue = await resolveWorkoutQueueState({
    userId,
    routineId: workout.routineId,
    sets,
    storedQueueJson: queueJson,
  });

  return {
    ...rest,
    sets,
    queue,
  };
}

/**
 * Updates a workout (endedAt, note, mood)
 */
export async function updateWorkout(
  workoutId: number,
  userId: number,
  data: UpdateWorkoutInput
): Promise<Workout> {
  // Validate mood if provided
  if (data.mood !== undefined && data.mood !== null) {
    if (data.mood < 1 || data.mood > 5) {
      throw new AppError('VALIDATION', 'El estado de ánimo debe estar entre 1 y 5');
    }
  }

  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
  });

  if (!workout || workout.deletedAt) {
    throw new AppError('NOT_FOUND', 'Entrenamiento no encontrado');
  }

  if (workout.userId !== userId) {
    throw new AppError('FORBIDDEN', 'No tienes permiso para modificar este entrenamiento');
  }

  const [updated] = await db
    .update(workouts)
    .set(data)
    .where(eq(workouts.id, workoutId))
    .returning();

  if (data.endedAt !== undefined) {
    await updateStreakFromActivity(userId);
  }

  return updated;
}

/**
 * Soft deletes a workout
 */
export async function deleteWorkout(workoutId: number, userId: number): Promise<void> {
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
  });

  if (!workout || workout.deletedAt) {
    throw new AppError('NOT_FOUND', 'Entrenamiento no encontrado');
  }

  if (workout.userId !== userId) {
    throw new AppError('FORBIDDEN', 'No tienes permiso para eliminar este entrenamiento');
  }

  await db.update(workouts).set({ deletedAt: new Date() }).where(eq(workouts.id, workoutId));
}

/**
 * Gets the active workout (not ended) for a user
 */
export async function getActiveWorkout(userId: number): Promise<Workout | null> {
  return (await findActiveWorkoutRow(userId)) || null;
}
