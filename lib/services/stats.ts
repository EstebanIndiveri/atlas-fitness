import { eq, and, isNull, desc } from 'drizzle-orm';
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
 * Note: Must calculate max in application code because MAX(text) in SQLite is lexicographic
 */
export async function getPersonalRecords(userId: number): Promise<PersonalRecord[]> {
  // Get all sets for the user with exercise info and workout date
  const allSets = await db
    .select({
      exerciseId: workoutSets.exerciseId,
      exerciseName: exercises.name,
      weightKg: workoutSets.weightKg,
      workoutDate: workouts.startedAt,
      workoutId: workouts.id,
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

  // Group by exercise and calculate PR in application code
  const prMap = new Map<number, PersonalRecord>();

  for (const set of allSets) {
    const existing = prMap.get(set.exerciseId);

    if (!existing) {
      prMap.set(set.exerciseId, {
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseName,
        maxWeightKg: set.weightKg,
        recordDate: set.workoutDate,
        workoutId: set.workoutId,
      });
    } else {
      const comparison = compareDecimal(set.weightKg, existing.maxWeightKg);

      if (comparison > 0) {
        // New max weight
        prMap.set(set.exerciseId, {
          exerciseId: set.exerciseId,
          exerciseName: set.exerciseName,
          maxWeightKg: set.weightKg,
          recordDate: set.workoutDate,
          workoutId: set.workoutId,
        });
      } else if (comparison === 0) {
        // Tie on weight - use most recent workout (or higher workout ID if dates equal)
        if (
          set.workoutDate > existing.recordDate ||
          (set.workoutDate.getTime() === existing.recordDate.getTime() &&
            set.workoutId > existing.workoutId)
        ) {
          prMap.set(set.exerciseId, {
            exerciseId: set.exerciseId,
            exerciseName: set.exerciseName,
            maxWeightKg: set.weightKg,
            recordDate: set.workoutDate,
            workoutId: set.workoutId,
          });
        }
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
