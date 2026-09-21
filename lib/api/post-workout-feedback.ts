import { parseApiErrorBody } from '@/lib/routines/parse-error';
import type { DiscomfortEntry, PostWorkoutFeedbackDto, WorkoutSensation } from '@/lib/services/post-workout-feedback';
import type { ApiError } from '@/types/errors';
import type { Metric } from '@/types/metric';

const INVALID_API_BODY = Symbol('invalid-api-body');

export type PostWorkoutFeedbackResponse = PostWorkoutFeedbackDto;
export type PostWorkoutFeedbackClientErrorKind = 'unauthorized' | 'not_found' | 'validation' | 'generic';

export interface RecordPostWorkoutFeedbackInput {
  workoutId: number;
  effort: number;
  sensation: WorkoutSensation;
  discomfort: DiscomfortEntry[];
  note?: string | null;
}

export class PostWorkoutFeedbackClientError extends Error {
  constructor(
    public kind: PostWorkoutFeedbackClientErrorKind,
    message: string,
    public status: number,
    public api: ApiError | null = null,
  ) {
    super(message);
    this.name = 'PostWorkoutFeedbackClientError';
  }
}

/**
 * Records optional post-workout feedback for the authenticated user.
 *
 * @param input - Workout id plus user-submitted feedback fields forwarded to the API.
 * @returns The persisted feedback DTO.
 * @throws {PostWorkoutFeedbackClientError} When the API fails or returns an invalid DTO.
 * @example
 * await recordPostWorkoutFeedback({ workoutId: 22, effort: 8, sensation: 'good', discomfort: [] });
 */
export async function recordPostWorkoutFeedback(
  input: RecordPostWorkoutFeedbackInput,
): Promise<PostWorkoutFeedbackResponse> {
  const { workoutId, ...bodyInput } = input;
  const response = await fetch(`/api/workouts/${workoutId}/feedback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(bodyInput),
  });
  const body = await readBody(response);

  if (body === INVALID_API_BODY) {
    throw invalidBodyError(response.status);
  }

  if (!response.ok) {
    throw mapPostWorkoutFeedbackHttpError(response.status, body);
  }

  const parsed = parsePostWorkoutFeedbackResponse(body);
  if (!parsed) {
    throw new PostWorkoutFeedbackClientError(
      'generic',
      'No se pudo cargar el feedback post-entrenamiento',
      response.status,
    );
  }

  return parsed;
}

/**
 * Fetches optional post-workout feedback for the authenticated user.
 *
 * @param workoutId - Workout id from the route segment.
 * @returns The feedback DTO, or null when absent.
 * @throws {PostWorkoutFeedbackClientError} When the API fails or returns an invalid DTO.
 */
export async function fetchPostWorkoutFeedback(
  workoutId: number,
): Promise<PostWorkoutFeedbackResponse | null> {
  const response = await fetch(`/api/workouts/${workoutId}/feedback`);
  const body = await readBody(response);

  if (body === INVALID_API_BODY) {
    throw invalidBodyError(response.status);
  }

  if (!response.ok) {
    throw mapPostWorkoutFeedbackHttpError(response.status, body);
  }

  if (body === null) {
    return null;
  }

  const parsed = parsePostWorkoutFeedbackResponse(body);
  if (!parsed) {
    throw new PostWorkoutFeedbackClientError(
      'generic',
      'No se pudo cargar el feedback post-entrenamiento',
      response.status,
    );
  }

  return parsed;
}

export const getPostWorkoutFeedback = fetchPostWorkoutFeedback;

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

function invalidBodyError(status: number): PostWorkoutFeedbackClientError {
  return new PostWorkoutFeedbackClientError('generic', 'No se pudo cargar el feedback post-entrenamiento', status);
}

function mapPostWorkoutFeedbackHttpError(
  status: number,
  body: unknown,
): PostWorkoutFeedbackClientError {
  const api = parseApiErrorBody(body);

  if (status === 401 || api?.code === 'UNAUTHORIZED') {
    return new PostWorkoutFeedbackClientError(
      'unauthorized',
      api?.message || 'Autenticación requerida',
      status,
      api,
    );
  }

  if (status === 404 || api?.code === 'NOT_FOUND') {
    return new PostWorkoutFeedbackClientError(
      'not_found',
      api?.message || 'Entrenamiento no encontrado',
      status,
      api,
    );
  }

  if (status === 400 || api?.code === 'VALIDATION') {
    return new PostWorkoutFeedbackClientError(
      'validation',
      api?.message || 'Feedback post-entrenamiento inválido',
      status,
      api,
    );
  }

  return new PostWorkoutFeedbackClientError(
    'generic',
    api?.message || 'No se pudo cargar el feedback post-entrenamiento',
    status,
    api,
  );
}

function parsePostWorkoutFeedbackResponse(value: unknown): PostWorkoutFeedbackResponse | null {
  if (!isRecord(value) || !isInteger(value.id) || !isInteger(value.workoutId)) {
    return null;
  }

  if (
    typeof value.localDate !== 'string' ||
    !isMetric(value.effort, isNumber) ||
    !isMetric(value.sensation, isWorkoutSensation) ||
    !isMetric(value.discomfort, isDiscomfortEntries) ||
    (value.note !== null && typeof value.note !== 'string') ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    workoutId: value.workoutId,
    localDate: value.localDate,
    effort: value.effort,
    sensation: value.sensation,
    discomfort: value.discomfort,
    note: value.note,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function isMetric<T>(
  value: unknown,
  isValue: (candidate: unknown) => candidate is T,
): value is Metric<T> {
  return isRecord(value) && isValue(value.value) && value.source === 'user_input';
}

function isDiscomfortEntries(value: unknown): value is DiscomfortEntry[] {
  return Array.isArray(value) && value.every(isDiscomfortEntry);
}

function isDiscomfortEntry(value: unknown): value is DiscomfortEntry {
  return (
    isRecord(value) &&
    isDiscomfortArea(value.area) &&
    (value.intensity === 'mild' || value.intensity === 'moderate' || value.intensity === 'strong')
  );
}

function isDiscomfortArea(value: unknown): value is DiscomfortEntry['area'] {
  return (
    value === 'neck' ||
    value === 'shoulder' ||
    value === 'elbow' ||
    value === 'wrist' ||
    value === 'back' ||
    value === 'hip' ||
    value === 'knee' ||
    value === 'ankle' ||
    value === 'other'
  );
}

function isWorkoutSensation(value: unknown): value is WorkoutSensation {
  return (
    value === 'great' ||
    value === 'good' ||
    value === 'neutral' ||
    value === 'hard' ||
    value === 'bad'
  );
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
