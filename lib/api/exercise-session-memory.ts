import { parseApiErrorBody } from '@/lib/routines/parse-error';
import {
  parseExerciseSessionContext,
  parseWorkoutExerciseNote,
} from '@/lib/session/exercise-session-memory';
import type { ExerciseSessionContext, WorkoutExerciseNote } from '@/types/exercise-session-memory';
import type { ApiError } from '@/types/errors';

/**
 * Browser-side typed client for the exercise-session memory API (Atlas v0.11,
 * Workstream C).
 *
 * Every successful response is parsed from `unknown` with the Workstream A total
 * parsers: malformed dates, numeric weights, unknown fields and cross-source
 * shapes are rejected instead of being shown to the user. The API errors are
 * surfaced as a typed {@link ExerciseSessionMemoryClientError} carrying the HTTP
 * status plus the `{code,message}` body when present.
 */

const INVALID_API_BODY = Symbol('invalid-api-body');

const GENERIC_MESSAGE = 'No se pudo cargar la memoria del ejercicio';

export type ExerciseSessionMemoryClientErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'generic';

/** Typed failure for the exercise-session memory client. */
export class ExerciseSessionMemoryClientError extends Error {
  constructor(
    public kind: ExerciseSessionMemoryClientErrorKind,
    message: string,
    public status: number,
    public api: ApiError | null = null,
  ) {
    super(message);
    this.name = 'ExerciseSessionMemoryClientError';
  }
}

export interface PutWorkoutExerciseNoteInput {
  workoutId: number;
  exerciseId: number;
  note: string;
  expectedNoteId: number | null;
  expectedVersion: number | null;
}

export interface DeleteWorkoutExerciseNoteInput {
  workoutId: number;
  exerciseId: number;
  expectedNoteId: number;
  expectedVersion: number;
}

export type DeleteWorkoutExerciseNoteResponse = { note: null };

/**
 * Fetches the bounded context for one exercise encounter.
 *
 * @param workoutId - Workout id from the route segment.
 * @param exerciseId - Exercise id from the route segment.
 * @returns The typed context with independent current/last-completed sources.
 * @throws {ExerciseSessionMemoryClientError} When the API fails or the body is malformed.
 */
export async function fetchExerciseSessionContext(
  workoutId: number,
  exerciseId: number,
): Promise<ExerciseSessionContext> {
  const response = await fetch(contextUrl(workoutId, exerciseId));
  const body = await readBody(response);

  if (body === INVALID_API_BODY) {
    throw invalidBodyError(response.status);
  }
  if (!response.ok) {
    throw mapExerciseSessionHttpError(response.status, body);
  }

  const parsed = parseExerciseSessionContext(body);
  if (!parsed) {
    throw invalidBodyError(response.status);
  }

  return parsed;
}

/**
 * Creates or updates the current note with compare-and-swap semantics.
 *
 * @param input - Workout/exercise ids plus the note text and CAS token.
 * @returns The persisted note, exactly as the server stored it.
 * @throws {ExerciseSessionMemoryClientError} When the API fails or the body is malformed.
 */
export async function putWorkoutExerciseNote(
  input: PutWorkoutExerciseNoteInput,
): Promise<WorkoutExerciseNote> {
  const { workoutId, exerciseId, ...token } = input;
  const response = await fetch(noteUrl(workoutId, exerciseId), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(token),
  });
  const body = await readBody(response);

  if (body === INVALID_API_BODY) {
    throw invalidBodyError(response.status);
  }
  if (!response.ok) {
    throw mapExerciseSessionHttpError(response.status, body);
  }

  const parsed = parseWorkoutExerciseNote(body);
  if (!parsed) {
    throw invalidBodyError(response.status);
  }

  return parsed;
}

/**
 * Deletes the current note with compare-and-swap semantics.
 *
 * @param input - Workout/exercise ids plus the exact CAS token.
 * @returns `{ note: null }` on success.
 * @throws {ExerciseSessionMemoryClientError} When the API fails or the body is malformed.
 */
export async function deleteWorkoutExerciseNote(
  input: DeleteWorkoutExerciseNoteInput,
): Promise<DeleteWorkoutExerciseNoteResponse> {
  const { workoutId, exerciseId, ...token } = input;
  const response = await fetch(noteUrl(workoutId, exerciseId), {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(token),
  });
  const body = await readBody(response);

  if (body === INVALID_API_BODY) {
    throw invalidBodyError(response.status);
  }
  if (!response.ok) {
    throw mapExerciseSessionHttpError(response.status, body);
  }

  if (!isDeletedNoteResponse(body)) {
    throw invalidBodyError(response.status);
  }

  return body;
}

function contextUrl(workoutId: number, exerciseId: number): string {
  return `/api/workouts/${workoutId}/exercises/${exerciseId}/context`;
}

function noteUrl(workoutId: number, exerciseId: number): string {
  return `/api/workouts/${workoutId}/exercises/${exerciseId}/note`;
}

async function readBody(response: Response): Promise<unknown | typeof INVALID_API_BODY> {
  const text = await response.text();
  if (!text) {
    return INVALID_API_BODY;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return INVALID_API_BODY;
  }
}

function invalidBodyError(status: number): ExerciseSessionMemoryClientError {
  return new ExerciseSessionMemoryClientError('generic', GENERIC_MESSAGE, status);
}

function mapExerciseSessionHttpError(
  status: number,
  body: unknown,
): ExerciseSessionMemoryClientError {
  const api = parseApiErrorBody(body);
  const message = api?.message || GENERIC_MESSAGE;

  if (status === 401 || api?.code === 'UNAUTHORIZED') {
    return new ExerciseSessionMemoryClientError(
      'unauthorized',
      api?.message || 'Autenticación requerida',
      status,
      api,
    );
  }

  if (status === 403 || api?.code === 'FORBIDDEN') {
    return new ExerciseSessionMemoryClientError(
      'forbidden',
      api?.message || 'No tienes permiso para acceder a este entrenamiento',
      status,
      api,
    );
  }

  if (status === 404 || api?.code === 'NOT_FOUND') {
    return new ExerciseSessionMemoryClientError(
      'not_found',
      api?.message || 'Ejercicio no encontrado',
      status,
      api,
    );
  }

  if (status === 400 || api?.code === 'VALIDATION') {
    return new ExerciseSessionMemoryClientError(
      'validation',
      api?.message || 'Datos de la nota del ejercicio inválidos',
      status,
      api,
    );
  }

  if (status === 409 || api?.code === 'CONFLICT') {
    return new ExerciseSessionMemoryClientError(
      'conflict',
      api?.message || 'La nota del ejercicio cambió. Recargá e intentá de nuevo.',
      status,
      api,
    );
  }

  return new ExerciseSessionMemoryClientError('generic', message, status, api);
}

function isDeletedNoteResponse(value: unknown): value is DeleteWorkoutExerciseNoteResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    (value as Record<string, unknown>).note === null
  );
}
