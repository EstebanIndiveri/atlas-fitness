import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workouts, workoutSets, exercises } from '@/lib/db/schema';
import { AppError } from '@/types/errors';
import { compareDecimal } from '@/lib/format/decimal';

export interface PersonalRecord {
  exerciseId: number;
  exerciseName: string;
  maxWeightKg: string;
  recordDate: Date;
  workoutId: number;
}

export interface ExerciseHistoryEntry {
  workoutId: number;
  workoutDate: Date;
  setId: number;
  setIndex: number;
  reps: number;
  weightKg: string;
}

export interface ExerciseHistory {
  exerciseId: number;
  exerciseName: string;
  history: ExerciseHistoryEntry[];
}

/**
 * Gets personal records (PRs) for all exercises for a user
 * PR = max weight_kg per exercise; tie → most recent
 */
export async function getPersonalRecords(userId: number): Promise<PersonalRecord[]> {
  // Query to get max weight per exercise with most recent date on tie
  const prQuery = db
    .select({
      exerciseId: workoutSets.exerciseId,
      exerciseName: exercises.name,
      maxWeightKg: sql<string>`MAX(${workoutSets.weightKg})`.as('maxWeightKg'),
      // We'll get the most recent workout date for the max weight
      recordDate: sql<Date>`MAX(${workouts.startedAt})`.as('recordDate'),
      workoutId: sql<number>`MAX(${workouts.id})`.as('workoutId'),
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .innerJoin(exercises, eq(workoutSets.exerciseId, exercises.id))
    .where(
      and(
        eq(workouts.userId, userId),
        isNull(workouts.deletedAt),
        isNull(workoutSets.deletedAt),
        isNull(exercises.deletedAt)
      )
    );

  // Group by exercise
  const rawResults = await prQuery;

  // Process results to ensure tie-breaking by most recent
  // Group by exerciseId and find max weight, then most recent on tie
  const prMap = new Map<number, PersonalRecord>();

  for (const row of rawResults) {
    const existing = prMap.get(row.exerciseId);

    if (!existing) {
      prMap.set(row.exerciseId, {
        exerciseId: row.exerciseId,
        exerciseName: row.exerciseName,
        maxWeightKg: row.maxWeightKg,
        recordDate: row.recordDate,
        workoutId: row.workoutId,
      });
    } else {
      const comparison = compareDecimal(row.maxWeightKg, existing.maxWeightKg);

      if (comparison > 0) {
        // New max
        prMap.set(row.exerciseId, {
          exerciseId: row.exerciseId,
          exerciseName: row.exerciseName,
          maxWeightKg: row.maxWeightKg,
          recordDate: row.recordDate,
          workoutId: row.workoutId,
        });
      } else if (comparison === 0 && row.recordDate > existing.recordDate) {
        // Tie, but more recent
        prMap.set(row.exerciseId, {
          exerciseId: row.exerciseId,
          exerciseName: row.exerciseName,
          maxWeightKg: row.maxWeightKg,
          recordDate: row.recordDate,
          workoutId: row.workoutId,
        });
      }
    }
  }

  return Array.from(prMap.values());
}

/**
 * Gets exercise history for a specific exercise and user
 */
export async function getExerciseHistory(
  exerciseId: number,
  userId: number
): Promise<ExerciseHistory> {
  const exercise = await db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId),
  });

  if (!exercise || exercise.deletedAt) {
    throw new AppError('NOT_FOUND', 'Ejercicio no encontrado');
  }

  const history = await db
    .select({
      workoutId: workouts.id,
      workoutDate: workouts.startedAt,
      setId: workoutSets.id,
      setIndex: workoutSets.setIndex,
      reps: workoutSets.reps,
      weightKg: workoutSets.weightKg,
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .where(
      and(
        eq(workoutSets.exerciseId, exerciseId),
        eq(workouts.userId, userId),
        isNull(workouts.deletedAt),
        isNull(workoutSets.deletedAt)
      )
    )
    .orderBy(desc(workouts.startedAt), workoutSets.setIndex);

  return {
    exerciseId,
    exerciseName: exercise.name,
    history,
  };
}

/**
 * Checks if a weight is a PR for an exercise
 */
export async function isPR(
  userId: number,
  exerciseId: number,
  weightKg: string
): Promise<boolean> {
  const prs = await getPersonalRecords(userId);
  const exercisePR = prs.find((pr) => pr.exerciseId === exerciseId);

  if (!exercisePR) {
    // No previous record, so this is a PR
    return true;
  }

  const comparison = compareDecimal(weightKg, exercisePR.maxWeightKg);
  return comparison >= 0;
}
