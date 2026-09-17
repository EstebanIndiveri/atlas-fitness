import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workouts, workoutSets } from '@/lib/db/schema';
import { AppError } from '@/types/errors';
import { isValidWeightKg, parseWeightKg } from '@/lib/format/weight';
import type { WorkoutSet } from '@/lib/db/schema';

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
 * Validates and verifies workout ownership
 */
async function verifyWorkoutOwnership(
  workoutId: number,
  userId: number,
  allowEnded = false
): Promise<void> {
  const workout = await db.query.workouts.findFirst({
    where: eq(workouts.id, workoutId),
  });

  if (!workout || workout.deletedAt) {
    throw new AppError('NOT_FOUND', 'Entrenamiento no encontrado');
  }

  if (workout.userId !== userId) {
    throw new AppError('FORBIDDEN', 'No tienes permiso para modificar este entrenamiento');
  }

  if (!allowEnded && workout.endedAt) {
    throw new AppError('VALIDATION', 'No puedes agregar series a un entrenamiento finalizado');
  }
}

/**
 * Creates a new workout set (atomic operation)
 */
export async function createWorkoutSet(input: CreateWorkoutSetInput): Promise<WorkoutSet> {
  // Validate input
  if (input.reps <= 0) {
    throw new AppError('VALIDATION', 'Las repeticiones deben ser mayor a 0');
  }

  if (!isValidWeightKg(input.weightKg)) {
    throw new AppError('VALIDATION', 'Peso inválido');
  }

  // Verify ownership before insertion (prevents TOCTOU)
  await verifyWorkoutOwnership(input.workoutId, input.userId, false);

  const normalizedWeight = parseWeightKg(input.weightKg);

  // Atomic insert
  const [workoutSet] = await db
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

  return workoutSet;
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
  await verifyWorkoutOwnership(set.workoutId, input.userId, true);

  const updateData: Partial<typeof workoutSets.$inferInsert> = {};
  if (input.exerciseId !== undefined) updateData.exerciseId = input.exerciseId;
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
  await verifyWorkoutOwnership(set.workoutId, userId, true);

  await db.update(workoutSets).set({ deletedAt: new Date() }).where(eq(workoutSets.id, setId));
}

/**
 * Lists all sets for a workout, excluding soft deleted
 */
export async function listWorkoutSets(workoutId: number, userId: number): Promise<WorkoutSet[]> {
  // Verify ownership
  await verifyWorkoutOwnership(workoutId, userId, true);

  return db.query.workoutSets.findMany({
    where: and(eq(workoutSets.workoutId, workoutId), isNull(workoutSets.deletedAt)),
    orderBy: (workoutSets, { asc }) => [asc(workoutSets.setIndex)],
  });
}
