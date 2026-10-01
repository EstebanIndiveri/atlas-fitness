import type { WeightKg } from '@/types/weight';

/**
 * Exercise-session memory domain contract (Atlas v0.11, Workstream A).
 *
 * This module declares the pure, transport-agnostic shapes for a user-declared
 * note about one exercise inside one workout, plus the bounded read model that
 * returns the previous completed encounter for that same exercise.
 *
 * Data-honesty boundaries (see the v0.11 product/architecture brief §§15–21):
 * - a note is explicit user input, never Atlas interpretation;
 * - historical sets are raw recorded reps and decimal-string weights for one
 *   exact `exerciseId`, never a delta, score, trend, PR, e1RM or recommendation;
 * - the current encounter, the last completed sets and the last completed note
 *   are three independent sources that may point at different workouts/dates;
 * - an open/current workout can never be reported as `lastCompleted`.
 *
 * Runtime normalization, validation and total parsers live in
 * `lib/session/exercise-session-memory.ts`. This file is types only.
 */

/** Why a candidate exercise note was rejected. */
export type ExerciseNoteRejection = 'not_text' | 'empty' | 'too_long';

/**
 * Result of validating a candidate exercise note.
 *
 * `ok: true` carries the trimmed note and its code-point count so callers never
 * have to recount with `.length`.
 */
export type ExerciseNoteValidation =
  | { ok: true; note: string; codePoints: number }
  | { ok: false; reason: ExerciseNoteRejection };

/**
 * A user-declared note owned by one user for one exercise inside one workout.
 *
 * Ownership is defense in depth: `userId` is the workout owner and is never
 * accepted from a request body. `note` is trimmed and 1–280 Unicode code
 * points. `version` is an integer CAS token starting at 1.
 */
export interface WorkoutExerciseNote {
  id: number;
  userId: number;
  workoutId: number;
  exerciseId: number;
  note: string;
  version: number;
  /** ISO-8601 instant the note row was created. */
  createdAt: string;
  /** ISO-8601 instant of the latest write; never before `createdAt`. */
  updatedAt: string;
}

/**
 * One raw recorded set of the previous completed encounter.
 *
 * `weightKg` stays the exact persisted decimal string; it is never parsed to a
 * float or normalized here. Values are historical records, not recommendations.
 *
 * The declared semantic tuple travels with the raw amount so a bodyweight `"0"`
 * sentinel, an assistance magnitude or a per-side amount is never silently
 * reinterpreted as one generic "kg" number. When `semanticCaptureVersion` is
 * `null` the entire tuple is `null`: the row is legacy/unknown and must be
 * displayed as a recorded amount without inferred meaning.
 */
export interface ExerciseSessionSetSnapshot {
  id: number;
  exerciseId: number;
  setIndex: number;
  reps: number;
  weightKg: WeightKg;
  semanticCaptureVersion: number | null;
  loadMode: string | null;
  amountBasis: string | null;
  side: string | null;
  setPurpose: string | null;
  repCountBasis: string | null;
}

/**
 * Latest completed, non-deleted, owned workout containing eligible sets for one
 * exact exercise. Ordered by `setIndex` at the source; gaps are allowed.
 */
export interface LastCompletedExerciseSets {
  workoutId: number;
  exerciseId: number;
  /** Córdoba calendar date (`YYYY-MM-DD`) derived from `endedAt`. */
  localDate: string;
  /** ISO-8601 instant the source workout ended. */
  endedAt: string;
  /** At least one eligible set, all for the same `exerciseId`. */
  sets: ExerciseSessionSetSnapshot[];
}

/**
 * Latest completed, non-deleted, owned workout containing a note for one exact
 * exercise. This source may differ from `LastCompletedExerciseSets`.
 */
export interface LastCompletedExerciseNote {
  workoutId: number;
  exerciseId: number;
  /** Córdoba calendar date (`YYYY-MM-DD`) derived from `endedAt`. */
  localDate: string;
  /** ISO-8601 instant the source workout ended. */
  endedAt: string;
  noteId: number;
  note: string;
  version: number;
}

/**
 * Bounded read model for the current exercise encounter.
 *
 * `currentNote` is the saved note for the requested workout/exercise;
 * `lastCompletedSets` and `lastCompletedNote` are historical and may come from
 * different workouts with independent `workoutId`/`localDate`. Any of the three
 * is `null` when absent — absence is represented as `null`, never as zeros,
 * empty strings or demo values.
 */
export interface ExerciseSessionContext {
  workoutId: number;
  exerciseId: number;
  currentNote: WorkoutExerciseNote | null;
  lastCompletedSets: LastCompletedExerciseSets | null;
  lastCompletedNote: LastCompletedExerciseNote | null;
}
