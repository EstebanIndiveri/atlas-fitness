import { AppError } from '@/types/errors';
import type {
  SessionQueueAction,
  WorkoutQueueActionResponse,
  WorkoutQueueState,
} from '@/types/session-queue';

export function parseStoredActionResponse(raw: string): WorkoutQueueActionResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new AppError('CONFLICT', 'No se pudo recuperar la mutación registrada.');
  }
  if (!isWorkoutQueueActionResponse(parsed)) {
    throw new AppError('CONFLICT', 'La mutación registrada tiene formato inválido.');
  }
  return parsed;
}

function isWorkoutQueueActionResponse(value: unknown): value is WorkoutQueueActionResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    isSessionQueueAction(record.action) &&
    typeof record.clientMutationId === 'string' &&
    typeof record.duplicate === 'boolean' &&
    isWorkoutQueueState(record.queue) &&
    isSuggestionRecord(record.suggestion) &&
    (record.sets === undefined || Array.isArray(record.sets))
  );
}

function isSessionQueueAction(value: unknown): value is SessionQueueAction {
  return value === 'skip' || value === 'hold';
}

function isWorkoutQueueState(value: unknown): value is WorkoutQueueState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    isIntegerArray(record.pendingExerciseIds) &&
    isIntegerArray(record.skippedExerciseIds) &&
    isIntegerArray(record.heldExerciseIds)
  );
}

function isIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item));
}

function isSuggestionRecord(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.source === 'string' &&
    typeof record.isLast === 'boolean' &&
    (record.nextExerciseId === null || Number.isInteger(record.nextExerciseId)) &&
    typeof record.message === 'string'
  );
}
