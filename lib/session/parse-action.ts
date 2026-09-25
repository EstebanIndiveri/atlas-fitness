import { SESSION_COPY } from '@/lib/copy/session';
import { parseStoredQueue } from '@/lib/session/queue';
import { parseApiErrorBody } from '@/lib/routines/parse-error';
import type { ApiError } from '@/types/errors';
import type { NextExerciseSuggestion, SuggestionSource } from '@/types/routine';
import type {
  SessionQueueAction,
  WorkoutQueueActionResponse,
  WorkoutQueueSetSnapshot,
  WorkoutQueueState,
} from '@/types/session-queue';

export type SessionQueueErrorKind = 'not_active' | 'validation' | 'unauthorized' | 'not_found' | 'generic';

export class SessionQueueClientError extends Error {
  constructor(
    public kind: SessionQueueErrorKind,
    message: string,
    public status: number,
    public api: ApiError | null = null,
  ) {
    super(message);
    this.name = 'SessionQueueClientError';
  }
}

const ACTIONS: readonly SessionQueueAction[] = ['skip', 'hold'];
const SOURCES: readonly SuggestionSource[] = ['gemini', 'fallback'];

export function parseWorkoutQueueState(value: unknown): WorkoutQueueState | null {
  return parseStoredQueue(value);
}

export function parseWorkoutQueueActionResponse(value: unknown): WorkoutQueueActionResponse | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!isAction(record.action) || typeof record.clientMutationId !== 'string') {
    return null;
  }
  if (typeof record.duplicate !== 'boolean') {
    return null;
  }
  const queue = parseWorkoutQueueState(record.queue);
  const suggestion = parseSuggestion(record.suggestion);
  if (!queue || !suggestion) {
    return null;
  }

  const parsed: WorkoutQueueActionResponse = {
    action: record.action,
    clientMutationId: record.clientMutationId,
    duplicate: record.duplicate,
    queue,
    suggestion,
  };

  if (record.sets !== undefined) {
    const sets = parseSetSnapshots(record.sets);
    if (!sets) {
      return null;
    }
    parsed.sets = sets;
  }

  return parsed;
}

export function mapSessionQueueHttpError(status: number, body: unknown): SessionQueueClientError {
  const api = parseApiErrorBody(body);

  if (status === 401 || api?.code === 'UNAUTHORIZED') {
    return new SessionQueueClientError('unauthorized', SESSION_COPY.errorQueueAction, status, api);
  }

  if (status === 404 || api?.code === 'NOT_FOUND') {
    return new SessionQueueClientError('not_found', SESSION_COPY.errorQueueAction, status, api);
  }

  if (status === 400 || api?.code === 'VALIDATION') {
    const message = api?.message?.trim() || SESSION_COPY.errorNotActive;
    return new SessionQueueClientError('not_active', message, status, api);
  }

  return new SessionQueueClientError(
    'generic',
    api?.message?.trim() || SESSION_COPY.errorQueueAction,
    status,
    api,
  );
}

function parseSuggestion(value: unknown): NextExerciseSuggestion | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!isSource(record.source) || typeof record.isLast !== 'boolean') {
    return null;
  }
  if (typeof record.message !== 'string') {
    return null;
  }
  if (record.nextExerciseId !== null && typeof record.nextExerciseId !== 'number') {
    return null;
  }
  if (typeof record.nextExerciseId === 'number' && !Number.isInteger(record.nextExerciseId)) {
    return null;
  }
  return {
    source: record.source,
    isLast: record.isLast,
    nextExerciseId: record.nextExerciseId,
    message: record.message,
  };
}

function parseSetSnapshots(value: unknown): WorkoutQueueSetSnapshot[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const sets: WorkoutQueueSetSnapshot[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      return null;
    }
    const record = item as Record<string, unknown>;
    if (
      typeof record.id !== 'number' ||
      typeof record.exerciseId !== 'number' ||
      typeof record.setIndex !== 'number' ||
      typeof record.reps !== 'number' ||
      typeof record.weightKg !== 'string'
    ) {
      return null;
    }
    sets.push({
      id: record.id,
      exerciseId: record.exerciseId,
      setIndex: record.setIndex,
      reps: record.reps,
      weightKg: record.weightKg,
    });
  }
  return sets;
}

function isAction(value: unknown): value is SessionQueueAction {
  return typeof value === 'string' && ACTIONS.includes(value as SessionQueueAction);
}

function isSource(value: unknown): value is SuggestionSource {
  return typeof value === 'string' && SOURCES.includes(value as SuggestionSource);
}
