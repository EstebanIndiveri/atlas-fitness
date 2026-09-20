import { and, eq, gte, inArray, isNull, lt } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { routineExercises, workoutSets, workouts } from '@/lib/db/schema';
import { cordobaLocalDate, cordobaLocalDateToUtcRange } from '@/lib/time/cordoba';

/**
 * Honest, deterministic progress of a routine for a single Córdoba day.
 *
 * `completed` counts distinct routine exercises that have at least one completed,
 * non-deleted set logged today; `total` is the routine's exercise count. Both are
 * real counts (`source: atlas_computed`); no target, ratio, or percentage is
 * fabricated (DATA HONESTY RULE). `completed` never exceeds `total`.
 */
export interface RoutineCompletion {
  completed: number;
  total: number;
}

/**
 * Computes today's completion of a routine for a user in Córdoba local time.
 *
 * @param userId - Authenticated user id.
 * @param routineId - Routine whose exercises define the total.
 * @param now - Instant used to resolve the Córdoba local date (defaults to now).
 * @returns Completed and total exercise counts for today.
 * @example
 * const { completed, total } = await getTodayRoutineCompletion(1, 10);
 */
export async function getTodayRoutineCompletion(
  userId: number,
  routineId: number,
  now: Date = new Date(),
): Promise<RoutineCompletion> {
  const routineExerciseRows = await db
    .select({ exerciseId: routineExercises.exerciseId })
    .from(routineExercises)
    .where(eq(routineExercises.routineId, routineId));

  const routineExerciseIds = routineExerciseRows.map((row) => row.exerciseId);
  const total = routineExerciseIds.length;

  if (total === 0) {
    return { completed: 0, total: 0 };
  }

  const { startUtc, endUtc } = cordobaLocalDateToUtcRange(cordobaLocalDate(now));

  const todayWorkoutRows = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        eq(workouts.routineId, routineId),
        isNull(workouts.deletedAt),
        gte(workouts.startedAt, startUtc),
        lt(workouts.startedAt, endUtc),
      ),
    );

  const todayWorkoutIds = todayWorkoutRows.map((row) => row.id);

  if (todayWorkoutIds.length === 0) {
    return { completed: 0, total };
  }

  const completedSetRows = await db
    .select({ exerciseId: workoutSets.exerciseId })
    .from(workoutSets)
    .where(
      and(
        inArray(workoutSets.workoutId, todayWorkoutIds),
        inArray(workoutSets.exerciseId, routineExerciseIds),
        eq(workoutSets.completed, true),
        isNull(workoutSets.deletedAt),
      ),
    );

  const completedExerciseIds = new Set(completedSetRows.map((row) => row.exerciseId));

  return { completed: completedExerciseIds.size, total };
}
