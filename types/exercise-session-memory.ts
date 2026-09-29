import type { WeightKg } from '@/types/weight';

/**
 * Exercise-session memory contract (Atlas v0.11, Workstream A).
 *
 * A note is explicit user-authored text attached to one exact exercise inside
 * one workout. The read model assembles the current note plus the latest
 * completed historical context for that same exercise. The total parsers for
 * these DTOs live in `@/lib/session/parse-exercise-session-memory`.
 *
 * Honesty boundaries enforced by the contract:
 * - historical set values are raw `reps` plus a decimal-string `weightKg`;
 * - the two historical sources (sets and note) may come from different workouts
 *   and carry independent workout ids and Córdoba local dates;
 * - an open workout can never be reported as `lastCompleted`;
 * - no delta, score, trend, PR, e1RM, readiness, pain meaning or recommendation
 *   is represented or inferred;
 * - nothing is compared across exercises: identity is the exact `exerciseId`.
 */

/** Stored, owned note for one exercise inside one workout. */
export interface WorkoutExerciseNote {
  /** Surrogate key of the note row. */
  id: number;
  /** Owner of the note. Never accepted from a request body by the service. */
  userId: number;
  /** Workout the note belongs to (must be the workout owner's workout). */
  workoutId: number;
  /** Exact exercise identity the note refers to. */
  exerciseId: number;
  /** Canonical stored note text: trimmed, non-empty, ≤ 280 code points. */
  note: string;
  /** Optimistic-concurrency version, starts at 1. */
  version: number;
  /** Row creation timestamp in ISO 8601 form. */
  createdAt: string;
  /** Row last-update timestamp in ISO 8601 form. */
  updatedAt: string;
}

/** One raw historical set, copied verbatim from a completed workout. */
export interface ExerciseSessionHistoricalSet {
  /** Surrogate key of the original workout set. */
  id: number;
  /** Exact exercise identity; must match the context exercise. */
  exerciseId: number;
  /** Historical order within the source workout. Gaps are allowed. */
  setIndex: number;
  /** Raw repetition count as entered by the user. */
  reps: number;
  /** Raw weight as a decimal string; never a float. */
  weightKg: WeightKg;
}

/** Latest completed encounter that contains sets for the exact exercise. */
export interface ExerciseSessionLastCompletedSets {
  /** Source workout id; always different from the requested workout. */
  workoutId: number;
  /** Córdoba display date (`YYYY-MM-DD`) derived from the source `endedAt`. */
  localDate: string;
  /** Non-empty raw sets ordered by `setIndex` then id. */
  sets: ExerciseSessionHistoricalSet[];
}

/** Latest completed encounter that contains a note for the exact exercise. */
export interface ExerciseSessionLastCompletedNote {
  /** Source workout id; may differ from the sets source and current workout. */
  workoutId: number;
  /** Córdoba display date (`YYYY-MM-DD`) derived from the source `endedAt`. */
  localDate: string;
  /** Frozen historical note text, trimmed only. */
  note: string;
}

/** Read model combining the current note and the last completed context. */
export interface ExerciseSessionContext {
  /** Requested active workout id. */
  workoutId: number;
  /** Exact exercise identity the context is for. */
  exerciseId: number;
  /** Saved note for the requested workout/exercise, or null when absent. */
  currentNote: WorkoutExerciseNote | null;
  /** Latest completed sets for the exercise, or null when there are none. */
  lastCompletedSets: ExerciseSessionLastCompletedSets | null;
  /** Latest completed note for the exercise, or null when there is none. */
  lastCompletedNote: ExerciseSessionLastCompletedNote | null;
}
