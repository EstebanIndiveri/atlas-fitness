import { eq, and, isNull, asc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { exercises, routineExercises, routines } from '@/lib/db/schema';
import { AppError } from '@/types/errors';
import type { RoutineKind, RoutineSummary } from '@/types/routine';

function asKind(value: string): RoutineKind {
  return value === 'home' ? 'home' : 'gym';
}

export async function listRoutines(): Promise<RoutineSummary[]> {
  const rows = await db.query.routines.findMany({
    where: isNull(routines.deletedAt),
    orderBy: [asc(routines.id)],
  });

  const result: RoutineSummary[] = [];
  for (const row of rows) {
    result.push(await loadRoutineExercises(row));
  }
  return result;
}

export async function getRoutineById(routineId: number): Promise<RoutineSummary> {
  const row = await db.query.routines.findFirst({
    where: eq(routines.id, routineId),
  });

  if (!row || row.deletedAt) {
    throw new AppError('NOT_FOUND', 'Rutina no encontrada');
  }

  return loadRoutineExercises(row);
}

async function loadRoutineExercises(
  row: typeof routines.$inferSelect,
): Promise<RoutineSummary> {
  const items = await db
    .select({
      id: routineExercises.id,
      routineId: routineExercises.routineId,
      exerciseId: routineExercises.exerciseId,
      sortOrder: routineExercises.sortOrder,
      targetSets: routineExercises.targetSets,
      targetReps: routineExercises.targetReps,
      exerciseName: exercises.name,
      muscleGroup: exercises.muscleGroup,
      instructions: exercises.instructions,
      imageUrl: exercises.imageUrl,
      videoUrl: exercises.videoUrl,
      deletedAt: exercises.deletedAt,
    })
    .from(routineExercises)
    .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
    .where(and(eq(routineExercises.routineId, row.id), isNull(exercises.deletedAt)))
    .orderBy(asc(routineExercises.sortOrder));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    kind: asKind(row.kind),
    restSeconds: row.restSeconds,
    exercises: items.map((item) => ({
      id: item.id,
      routineId: item.routineId,
      exerciseId: item.exerciseId,
      sortOrder: item.sortOrder,
      targetSets: item.targetSets,
      targetReps: item.targetReps,
      exerciseName: item.exerciseName,
      muscleGroup: item.muscleGroup,
      instructions: item.instructions,
      imageUrl: item.imageUrl,
      videoUrl: item.videoUrl,
    })),
  };
}
