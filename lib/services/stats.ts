import { eq, and, isNull, desc, gt, lt, or } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workouts, workoutSets, exercises } from '@/lib/db/schema';
import { requireAccessibleExercise } from '@/lib/services/exercises';
import { compareDecimal } from '@/lib/format/decimal';
import {
  decodeExerciseHistoryCursor,
  encodeExerciseHistoryCursor,
} from '@/lib/db/keyset-cursor';
import { AppError } from '@/types/errors';

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
  semanticCaptureVersion: number | null;
  loadMode: string | null;
  amountBasis: string | null;
  side: string | null;
  setPurpose: string | null;
  repCountBasis: string | null;
}

export interface ExerciseHistory {
  exerciseId: number;
  exerciseName: string;
  history: ExerciseHistoryEntry[];
  /** Keyset cursor for the next raw page, or null at the end. */
  nextCursor: string | null;
  bounded: true;
}

export interface ExerciseHistoryOptions {
  limit?: number;
  cursor?: string | null;
}

export const DEFAULT_RAW_HISTORY_LIMIT = 50;
export const MAX_RAW_HISTORY_LIMIT = 100;

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
 * Bounded raw exercise history (v0.12 raw compatibility surface).
 *
 * Returns recorded sets verbatim with their declared semantic tuple or an
 * unknown marker; it never exposes a PR, improvement, strength or normalized
 * resistance claim. Ordering is by workout start (desc) with a keyset cursor so
 * the page is bounded and stable across pages.
 */
export async function getExerciseHistory(
  exerciseId: number,
  userId: number,
  options: ExerciseHistoryOptions = {}
): Promise<ExerciseHistory> {
  const exercise = await requireAccessibleExercise(exerciseId, userId);

  const requestedLimit = options.limit;
  const limit =
    requestedLimit && Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_RAW_HISTORY_LIMIT)
      : DEFAULT_RAW_HISTORY_LIMIT;

  const cursor = options.cursor ? decodeExerciseHistoryCursor(options.cursor) : null;
  if (options.cursor && !cursor) {
    throw new AppError('VALIDATION', 'Cursor inválido');
  }

  const keyset = cursor
    ? (() => {
        const cursorStartedAt = new Date(cursor.sortAt);
        return or(
          lt(workouts.startedAt, cursorStartedAt),
          and(eq(workouts.startedAt, cursorStartedAt), lt(workouts.id, cursor.workoutId)),
          and(
            eq(workouts.startedAt, cursorStartedAt),
            eq(workouts.id, cursor.workoutId),
            gt(workoutSets.setIndex, cursor.setIndex),
          ),
          and(
            eq(workouts.startedAt, cursorStartedAt),
            eq(workouts.id, cursor.workoutId),
            eq(workoutSets.setIndex, cursor.setIndex),
            gt(workoutSets.id, cursor.setId),
          ),
        );
      })()
    : undefined;

  const rows = await db
    .select({
      workoutId: workouts.id,
      workoutDate: workouts.startedAt,
      setId: workoutSets.id,
      setIndex: workoutSets.setIndex,
      reps: workoutSets.reps,
      weightKg: workoutSets.weightKg,
      semanticCaptureVersion: workoutSets.semanticCaptureVersion,
      loadMode: workoutSets.loadMode,
      amountBasis: workoutSets.amountBasis,
      side: workoutSets.side,
      setPurpose: workoutSets.setPurpose,
      repCountBasis: workoutSets.repCountBasis,
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .where(
      and(
        eq(workoutSets.exerciseId, exerciseId),
        eq(workouts.userId, userId),
        isNull(workouts.deletedAt),
        isNull(workoutSets.deletedAt),
        keyset,
      )
    )
    .orderBy(desc(workouts.startedAt), desc(workouts.id), workoutSets.setIndex, workoutSets.id)
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeExerciseHistoryCursor({
          sortAt: last.workoutDate.toISOString(),
          workoutId: last.workoutId,
          setIndex: last.setIndex,
          setId: last.setId,
        })
      : null;

  return {
    exerciseId,
    exerciseName: exercise.name,
    history: page,
    nextCursor,
    bounded: true,
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
