import { isValidWeightKg } from '@/lib/format/weight';
import { isCanonicalExerciseNote } from '@/lib/session/exercise-note';
import type {
  ExerciseSessionContext,
  ExerciseSessionHistoricalSet,
  ExerciseSessionLastCompletedNote,
  ExerciseSessionLastCompletedSets,
  WorkoutExerciseNote,
} from '@/types/exercise-session-memory';

/**
 * Total parsers for the exercise-session memory read model (v0.11, Workstream A).
 *
 * Every parser accepts `unknown`, never throws, and returns `null` for
 * malformed or impossible states. Unknown fields are rejected rather than
 * ignored so no undeclared value (recommendation, delta, trend, …) leaks
 * through. Cross-source invariants are enforced here: an open workout is never
 * reported as last completed, historical sets must target the exact exercise,
 * and the two historical sources carry independent ids and dates.
 */

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const NOTE_KEYS = [
  'id',
  'userId',
  'workoutId',
  'exerciseId',
  'note',
  'version',
  'createdAt',
  'updatedAt',
] as const;

const HISTORICAL_SET_KEYS = ['id', 'exerciseId', 'setIndex', 'reps', 'weightKg'] as const;

const LAST_COMPLETED_SETS_KEYS = ['workoutId', 'localDate', 'sets'] as const;

const LAST_COMPLETED_NOTE_KEYS = ['workoutId', 'localDate', 'note'] as const;

const CONTEXT_KEYS = [
  'workoutId',
  'exerciseId',
  'currentNote',
  'lastCompletedSets',
  'lastCompletedNote',
] as const;

/**
 * Parses an untrusted value into a {@link WorkoutExerciseNote}.
 *
 * @param value Untrusted value from parsed JSON.
 * @returns The note DTO, or `null` when the value is malformed or carries
 *   unknown fields.
 */
export function parseWorkoutExerciseNote(value: unknown): WorkoutExerciseNote | null {
  if (!isRecord(value) || !hasExactKeys(value, NOTE_KEYS)) {
    return null;
  }

  if (
    !isPositiveInteger(value.id) ||
    !isPositiveInteger(value.userId) ||
    !isPositiveInteger(value.workoutId) ||
    !isPositiveInteger(value.exerciseId) ||
    !isCanonicalExerciseNote(value.note) ||
    !isPositiveInteger(value.version) ||
    !isIsoDateTime(value.createdAt) ||
    !isIsoDateTime(value.updatedAt)
  ) {
    return null;
  }

  return {
    id: value.id,
    userId: value.userId,
    workoutId: value.workoutId,
    exerciseId: value.exerciseId,
    note: value.note,
    version: value.version,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

/**
 * Parses an untrusted value into an {@link ExerciseSessionHistoricalSet}.
 *
 * @param value Untrusted value from parsed JSON.
 * @returns The historical set DTO, or `null` when malformed.
 */
export function parseExerciseSessionHistoricalSet(
  value: unknown,
): ExerciseSessionHistoricalSet | null {
  if (!isRecord(value) || !hasExactKeys(value, HISTORICAL_SET_KEYS)) {
    return null;
  }

  if (
    !isPositiveInteger(value.id) ||
    !isPositiveInteger(value.exerciseId) ||
    !isPositiveInteger(value.setIndex) ||
    !isPositiveInteger(value.reps) ||
    typeof value.weightKg !== 'string' ||
    !isValidWeightKg(value.weightKg)
  ) {
    return null;
  }

  return {
    id: value.id,
    exerciseId: value.exerciseId,
    setIndex: value.setIndex,
    reps: value.reps,
    weightKg: value.weightKg,
  };
}

/**
 * Parses the full {@link ExerciseSessionContext} read model.
 *
 * Cross-checks that the current note belongs to the requested workout/exercise,
 * that historical sets target the exact exercise, that at least one historical
 * set is present, and that no historical source is the current workout.
 *
 * @param value Untrusted value from parsed JSON.
 * @returns The validated context, or `null` when malformed or inconsistent.
 */
export function parseExerciseSessionContext(value: unknown): ExerciseSessionContext | null {
  if (!isRecord(value) || !hasExactKeys(value, CONTEXT_KEYS)) {
    return null;
  }

  if (!isPositiveInteger(value.workoutId) || !isPositiveInteger(value.exerciseId)) {
    return null;
  }

  const { workoutId, exerciseId } = value;

  let currentNote: WorkoutExerciseNote | null = null;
  if (value.currentNote !== null) {
    currentNote = parseWorkoutExerciseNote(value.currentNote);
    if (
      !currentNote ||
      currentNote.workoutId !== workoutId ||
      currentNote.exerciseId !== exerciseId
    ) {
      return null;
    }
  }

  let lastCompletedSets: ExerciseSessionLastCompletedSets | null = null;
  if (value.lastCompletedSets !== null) {
    lastCompletedSets = parseLastCompletedSets(value.lastCompletedSets);
    if (
      !lastCompletedSets ||
      lastCompletedSets.workoutId === workoutId ||
      lastCompletedSets.sets.some((set) => set.exerciseId !== exerciseId)
    ) {
      return null;
    }
  }

  let lastCompletedNote: ExerciseSessionLastCompletedNote | null = null;
  if (value.lastCompletedNote !== null) {
    lastCompletedNote = parseLastCompletedNote(value.lastCompletedNote);
    if (!lastCompletedNote || lastCompletedNote.workoutId === workoutId) {
      return null;
    }
  }

  return { workoutId, exerciseId, currentNote, lastCompletedSets, lastCompletedNote };
}

function parseLastCompletedSets(value: unknown): ExerciseSessionLastCompletedSets | null {
  if (!isRecord(value) || !hasExactKeys(value, LAST_COMPLETED_SETS_KEYS)) {
    return null;
  }

  if (!isPositiveInteger(value.workoutId) || !isCordobaLocalDate(value.localDate)) {
    return null;
  }

  if (!Array.isArray(value.sets) || value.sets.length === 0) {
    return null;
  }

  const sets: ExerciseSessionHistoricalSet[] = [];
  for (const item of value.sets) {
    const parsed = parseExerciseSessionHistoricalSet(item);
    if (!parsed) {
      return null;
    }
    sets.push(parsed);
  }

  return { workoutId: value.workoutId, localDate: value.localDate, sets };
}

function parseLastCompletedNote(value: unknown): ExerciseSessionLastCompletedNote | null {
  if (!isRecord(value) || !hasExactKeys(value, LAST_COMPLETED_NOTE_KEYS)) {
    return null;
  }

  if (
    !isPositiveInteger(value.workoutId) ||
    !isCordobaLocalDate(value.localDate) ||
    !isCanonicalExerciseNote(value.note)
  ) {
    return null;
  }

  return { workoutId: value.workoutId, localDate: value.localDate, note: value.note };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const ownKeys = Object.keys(record);
  return (
    ownKeys.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(record, key))
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isCordobaLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !LOCAL_DATE_RE.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}
