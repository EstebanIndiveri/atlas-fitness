import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workouts, workoutSets } from '@/lib/db/schema';
import { AppError } from '@/types/errors';
import type { Workout, WorkoutSet } from '@/lib/db/schema';

export interface WorkoutWithSets extends Workout {
  sets: WorkoutSet[];
}

export interface UpdateWorkoutInput {
  endedAt?: Date;
  note?: string | null;
  mood?: number | null;
}

/**
 * Creates a new workout for a user
 */
export async function createWorkout(userId: number): Promise<Workout> {
  const [workout] = await db
    .insert(workouts)
    .values({
      userId,
      startedAt: new Date(),
    })
    .returning();

  return workout;
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

  return {
    ...workout,
    sets,
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
  const workout = await db.query.workouts.findFirst({
    where: and(
      eq(workouts.userId, userId),
      isNull(workouts.endedAt),
      isNull(workouts.deletedAt)
    ),
    orderBy: desc(workouts.startedAt),
  });

  return workout || null;
}
