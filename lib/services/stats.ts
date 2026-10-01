import { eq, and, isNull, desc, gt, lt, or } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { workouts, workoutSets } from '@/lib/db/schema';
import { requireAccessibleExercise } from '@/lib/services/exercises';
import {
  decodeExerciseHistoryCursor,
  encodeExerciseHistoryCursor,
} from '@/lib/db/keyset-cursor';
import { AppError } from '@/types/errors';

/**
 * Raw exercise history and stats compatibility surface (Atlas Fitness v0.12).
 *
 * This module intentionally exposes **no** PR, improvement, strength or
 * normalized-resistance claim. The legacy `getPersonalRecords`/`isPR` pair was
 * retired because a bare `weight_kg` cannot be interpreted without declared
 * semantics; the truthful PR lives in `lib/services/exercise-progression.ts`.
 * `getExerciseHistory` stays as a bounded, raw compatibility read.
 */
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
