import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workouts, workoutSets } from '@/lib/db/schema';
import { isUniqueConstraintError } from '@/lib/db/unique-error';
import { requireAccessibleExercise } from '@/lib/services/exercises';
import { AppError } from '@/types/errors';
import { isValidWeightKg, parseWeightKg } from '@/lib/format/weight';
import type { Workout, WorkoutSet } from '@/lib/db/schema';

function assertWorkoutAllowsSetMutation(workout: Workout, action: 'create' | 'update' | 'delete'): void {
  if (!workout.endedAt) {
    return;
  }

  if (action === 'create') {
    throw new AppError('VALIDATION', 'No puedes agregar series a un entrenamiento finalizado');
  }
  if (action === 'update') {
    throw new AppError('VALIDATION', 'No puedes modificar series de un entrenamiento finalizado');
  }
  throw new AppError('VALIDATION', 'No puedes eliminar series de un entrenamiento finalizado');
}

export interface CreateWorkoutSetInput {
  workoutId: number;
  userId: number;
  exerciseId: number;
  setIndex: number;
  reps: number;
  weightKg: string;
}

export interface UpdateWorkoutSetInput {
  setId: number;
  userId: number;
  exerciseId?: number;
  setIndex?: number;
  reps?: number;
  weightKg?: string;
}

/**
 * Creates a new workout set (atomic operation with transaction)
 */
export async function createWorkoutSet(input: CreateWorkoutSetInput): Promise<WorkoutSet> {
  // Validate input
  if (input.reps <= 0) {
    throw new AppError('VALIDATION', 'Las repeticiones deben ser mayor a 0');
  }

  if (!isValidWeightKg(input.weightKg)) {
    throw new AppError('VALIDATION', 'Peso inválido');
  }

  const normalizedWeight = parseWeightKg(input.weightKg);

  try {
    // Use transaction to atomically verify and insert
    const [workoutSet] = await db.transaction(async (tx) => {
      // Verify ownership and workout state within transaction
      const workout = await tx.query.workouts.findFirst({
        where: eq(workouts.id, input.workoutId),
      });

      if (!workout || workout.deletedAt) {
        throw new AppError('NOT_FOUND', 'Entrenamiento no encontrado');
      }

      if (workout.userId !== input.userId) {
        throw new AppError('FORBIDDEN', 'No tienes permiso para modificar este entrenamiento');
      }

      assertWorkoutAllowsSetMutation(workout, 'create');
      await requireAccessibleExercise(input.exerciseId, input.userId);

      // Atomic insert - unique constraint will prevent duplicates
      return tx
        .insert(workoutSets)
        .values({
          workoutId: input.workoutId,
          exerciseId: input.exerciseId,
          setIndex: input.setIndex,
          reps: input.reps,
          weightKg: normalizedWeight,
          completed: true,
        })
        .returning();
    });

    return workoutSet;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new AppError('CONFLICT', 'Ya existe una serie con este índice en el entrenamiento');
    }
    throw error;
  }
}

/**
 * Updates a workout set
 */
export async function updateWorkoutSet(input: UpdateWorkoutSetInput): Promise<WorkoutSet> {
  // Validate weight if provided
  if (input.weightKg !== undefined && !isValidWeightKg(input.weightKg)) {
    throw new AppError('VALIDATION', 'Peso inválido');
  }

  // Validate reps if provided
  if (input.reps !== undefined && input.reps <= 0) {
    throw new AppError('VALIDATION', 'Las repeticiones deben ser mayor a 0');
  }

  const set = await db.query.workoutSets.findFirst({
    where: eq(workoutSets.id, input.setId),
  });

  if (!set || set.deletedAt) {
    throw new AppError('NOT_FOUND', 'Serie no encontrada');
  }

  // Verify workout ownership
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, set.workoutId),
  });

  if (!workout || workout.deletedAt) {
    throw new AppError('NOT_FOUND', 'Entrenamiento no encontrado');
  }

  if (workout.userId !== input.userId) {
    throw new AppError('FORBIDDEN', 'No tienes permiso para modificar esta serie');
  }

  assertWorkoutAllowsSetMutation(workout, 'update');

  const updateData: Partial<typeof workoutSets.$inferInsert> = {};
  if (input.exerciseId !== undefined) {
    await requireAccessibleExercise(input.exerciseId, input.userId);
    updateData.exerciseId = input.exerciseId;
  }
  if (input.setIndex !== undefined) updateData.setIndex = input.setIndex;
  if (input.reps !== undefined) updateData.reps = input.reps;
  if (input.weightKg !== undefined) updateData.weightKg = parseWeightKg(input.weightKg);

  const [updated] = await db
    .update(workoutSets)
    .set(updateData)
    .where(eq(workoutSets.id, input.setId))
    .returning();

  return updated;
}

/**
 * Soft deletes a workout set
 */
export async function deleteWorkoutSet(setId: number, userId: number): Promise<void> {
  const set = await db.query.workoutSets.findFirst({
    where: eq(workoutSets.id, setId),
  });

  if (!set || set.deletedAt) {
    throw new AppError('NOT_FOUND', 'Serie no encontrada');
  }

  // Verify workout ownership
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, set.workoutId),
  });

  if (!workout || workout.deletedAt) {
    throw new AppError('NOT_FOUND', 'Entrenamiento no encontrado');
  }

  if (workout.userId !== userId) {
    throw new AppError('FORBIDDEN', 'No tienes permiso para eliminar esta serie');
  }

  assertWorkoutAllowsSetMutation(workout, 'delete');

  await db.update(workoutSets).set({ deletedAt: new Date() }).where(eq(workoutSets.id, setId));
}

/**
 * Lists all sets for a workout, excluding soft deleted
 */
export async function listWorkoutSets(workoutId: number, userId: number): Promise<WorkoutSet[]> {
  // Verify ownership
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
  });

  if (!workout || workout.deletedAt) {
    throw new AppError('NOT_FOUND', 'Entrenamiento no encontrado');
  }

  if (workout.userId !== userId) {
    throw new AppError('FORBIDDEN', 'No tienes permiso para acceder a este entrenamiento');
  }

  return db.query.workoutSets.findMany({
    where: and(eq(workoutSets.workoutId, workoutId), isNull(workoutSets.deletedAt)),
    orderBy: (workoutSets, { asc }) => [asc(workoutSets.setIndex)],
  });
}
