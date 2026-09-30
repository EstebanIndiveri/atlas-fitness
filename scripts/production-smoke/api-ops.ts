import type { HttpResult } from './types';

/** Raised when a live API response violates the expected contract. */
export class ApiContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiContractError';
  }
}

/** Returns the parsed JSON body or throws on a malformed/non-JSON response. */
export function requireJson(result: HttpResult, label: string): unknown {
  if (!result.jsonOk) {
    throw new ApiContractError(`${label}: malformed JSON response`);
  }
  return result.body;
}

export function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiContractError(`${label}: expected JSON object`);
  }
  return value as Record<string, unknown>;
}

export function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ApiContractError(`${label}: expected JSON array`);
  }
  return value;
}

export function asNumber(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiContractError(`${label}: expected numeric "${key}"`);
  }
  return value;
}

export function asString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new ApiContractError(`${label}: expected string "${key}"`);
  }
  return value;
}

export function asNullableString(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string | null {
  const value = record[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new ApiContractError(`${label}: expected string|null "${key}"`);
  }
  return value;
}

function asPositiveInt(record: Record<string, unknown>, key: string, label: string): number {
  const value = asNumber(record, key, label);
  if (!Number.isInteger(value) || value <= 0) {
    throw new ApiContractError(`${label}: expected positive integer "${key}"`);
  }
  return value;
}

/** Authenticated identity as returned by login and `/api/auth/me`. */
export interface AuthIdentity {
  id: number;
  email: string;
}

export function parseAuthIdentity(body: unknown, label: string): AuthIdentity {
  const record = asRecord(body, label);
  return { id: asPositiveInt(record, 'id', label), email: asString(record, 'email', label) };
}

/** A persisted workout row with its run marker. */
export interface WorkoutArtifact {
  id: number;
  userId: number;
  routineId: number | null;
  note: string | null;
  startedAt: string;
  endedAt: string | null;
}

export function parseWorkout(body: unknown, label: string): WorkoutArtifact {
  const record = asRecord(body, label);
  const routineId = record.routineId;
  return {
    id: asPositiveInt(record, 'id', label),
    userId: asPositiveInt(record, 'userId', label),
    routineId:
      typeof routineId === 'number' && Number.isInteger(routineId) && routineId > 0
        ? routineId
        : null,
    note: asNullableString(record, 'note', label),
    startedAt: asString(record, 'startedAt', label),
    endedAt: asNullableString(record, 'endedAt', label),
  };
}

/** A persisted workout set preserving the exact decimal-string weight. */
export interface WorkoutSetRecord {
  id: number;
  exerciseId: number;
  setIndex: number;
  reps: number;
  weightKg: string;
}

export function parseWorkoutSet(body: unknown, label: string): WorkoutSetRecord {
  const record = asRecord(body, label);
  return {
    id: asPositiveInt(record, 'id', label),
    exerciseId: asPositiveInt(record, 'exerciseId', label),
    setIndex: asPositiveInt(record, 'setIndex', label),
    reps: asPositiveInt(record, 'reps', label),
    weightKg: asString(record, 'weightKg', label),
  };
}

export interface ContextNote {
  id: number;
  version: number;
  note: string;
  userId: number;
  workoutId: number;
  exerciseId: number;
}

export interface HistorySets {
  workoutId: number;
  exerciseId: number;
  sets: WorkoutSetRecord[];
}

export interface ExerciseContext {
  workoutId: number;
  exerciseId: number;
  currentNote: ContextNote | null;
  lastCompletedSets: HistorySets | null;
}

export function parseNote(body: unknown, label: string): ContextNote {
  const record = asRecord(body, label);
  return {
    id: asPositiveInt(record, 'id', label),
    version: asPositiveInt(record, 'version', label),
    note: asString(record, 'note', label),
    userId: asPositiveInt(record, 'userId', label),
    workoutId: asPositiveInt(record, 'workoutId', label),
    exerciseId: asPositiveInt(record, 'exerciseId', label),
  };
}

function parseHistorySets(body: unknown, label: string): HistorySets {
  const record = asRecord(body, label);
  const sets = asArray(record.sets, `${label}.sets`).map((set) =>
    parseWorkoutSet(set, `${label}.set`),
  );
  return {
    workoutId: asPositiveInt(record, 'workoutId', label),
    exerciseId: asPositiveInt(record, 'exerciseId', label),
    sets,
  };
}

export function parseExerciseContext(body: unknown, label: string): ExerciseContext {
  const record = asRecord(body, label);
  const lastCompleted = record.lastCompletedSets;
  return {
    workoutId: asPositiveInt(record, 'workoutId', label),
    exerciseId: asPositiveInt(record, 'exerciseId', label),
    currentNote:
      record.currentNote === null || record.currentNote === undefined
        ? null
        : parseNote(record.currentNote, `${label}.currentNote`),
    lastCompletedSets:
      lastCompleted === null || lastCompleted === undefined
        ? null
        : parseHistorySets(lastCompleted, `${label}.lastCompletedSets`),
  };
}

export interface StreakSnapshot {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

export function parseStreak(body: unknown, label: string): StreakSnapshot {
  const record = asRecord(body, label);
  return {
    currentStreak: asNumber(record, 'currentStreak', label),
    longestStreak: asNumber(record, 'longestStreak', label),
    lastActiveDate: asNullableString(record, 'lastActiveDate', label),
  };
}

export interface SelectedSystemRoutine {
  routineId: number;
  exerciseId: number;
}

/**
 * Selects a system routine and its first exact member exercise.
 *
 * @returns The selection, or `null` when no system routine exposes an exercise.
 */
export function selectSystemRoutine(body: unknown): SelectedSystemRoutine | null {
  for (const item of asArray(body, 'routines')) {
    const routine = asRecord(item, 'routine');
    if (routine.isSystem !== true) {
      continue;
    }
    const routineId = routine.id;
    if (typeof routineId !== 'number' || !Number.isInteger(routineId) || routineId <= 0) {
      continue;
    }
    for (const exercise of asArray(routine.exercises, 'routine.exercises')) {
      const record = asRecord(exercise, 'routineExercise');
      const exerciseId = record.exerciseId;
      if (typeof exerciseId === 'number' && Number.isInteger(exerciseId) && exerciseId > 0) {
        return { routineId, exerciseId };
      }
    }
  }
  return null;
}
