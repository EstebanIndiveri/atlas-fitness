import { parseApiErrorBody } from '@/lib/routines/parse-error';
import type { ApiError } from '@/types/errors';
import type { RoutineSummary } from '@/types/routine';

export type RoutineDetail = RoutineSummary;
export type RoutineDetailClientErrorKind = 'unauthorized' | 'not_found' | 'generic';

export class RoutineDetailClientError extends Error {
  constructor(
    public kind: RoutineDetailClientErrorKind,
    message: string,
    public status: number,
    public api: ApiError | null = null,
  ) {
    super(message);
    this.name = 'RoutineDetailClientError';
  }
}

/**
 * Fetches an authenticated routine detail from `/api/routines/[id]`.
 *
 * @param routineId Routine id returned by the Today contract.
 * @returns Runtime-validated routine detail with ordered exercises.
 * @throws {RoutineDetailClientError} When auth, not-found, transport, or validation fails.
 * @example
 * const routine = await fetchRoutineDetail(today.routineId);
 */
export async function fetchRoutineDetail(routineId: number): Promise<RoutineDetail> {
  if (!Number.isInteger(routineId) || routineId <= 0) {
    throw new RoutineDetailClientError('generic', 'Rutina inválida', 0);
  }

  const response = await fetch(`/api/routines/${routineId}`);
  const body = await readBody(response);

  if (!response.ok) {
    throw mapRoutineDetailHttpError(response.status, body);
  }

  const parsed = parseRoutineDetail(body);
  if (!parsed) {
    throw new RoutineDetailClientError(
      'generic',
      'No se pudo cargar el detalle de la rutina',
      response.status,
    );
  }

  return parsed;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return null;
  }
}

function mapRoutineDetailHttpError(status: number, body: unknown): RoutineDetailClientError {
  const api = parseApiErrorBody(body);
  if (status === 401 || api?.code === 'UNAUTHORIZED') {
    return new RoutineDetailClientError(
      'unauthorized',
      api?.message || 'Autenticación requerida',
      status,
      api,
    );
  }
  if (status === 404 || api?.code === 'NOT_FOUND') {
    return new RoutineDetailClientError(
      'not_found',
      api?.message || 'Rutina no encontrada',
      status,
      api,
    );
  }
  return new RoutineDetailClientError(
    'generic',
    api?.message || 'No se pudo cargar el detalle de la rutina',
    status,
    api,
  );
}

function parseRoutineDetail(value: unknown): RoutineDetail | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    !isInteger(value.id) ||
    typeof value.slug !== 'string' ||
    typeof value.name !== 'string' ||
    !isNullableString(value.description) ||
    !isRoutineKind(value.kind) ||
    !isInteger(value.restSeconds) ||
    typeof value.isSystem !== 'boolean' ||
    !Array.isArray(value.exercises)
  ) {
    return null;
  }

  const exercises = parseExercises(value.exercises);
  if (!exercises) {
    return null;
  }

  return {
    id: value.id,
    slug: value.slug,
    name: value.name,
    description: value.description,
    kind: value.kind,
    restSeconds: value.restSeconds,
    isSystem: value.isSystem,
    exercises,
  };
}

function parseExercises(values: unknown[]): RoutineDetail['exercises'] | null {
  const exercises: RoutineDetail['exercises'] = [];
  for (const item of values) {
    const exercise = parseRoutineExercise(item);
    if (!exercise) {
      return null;
    }
    exercises.push(exercise);
  }
  return exercises;
}

function parseRoutineExercise(value: unknown): RoutineDetail['exercises'][number] | null {
  if (
    !isRecord(value) ||
    !isInteger(value.id) ||
    !isInteger(value.routineId) ||
    !isInteger(value.exerciseId) ||
    !isInteger(value.sortOrder) ||
    !isInteger(value.targetSets) ||
    !isInteger(value.targetReps) ||
    typeof value.exerciseName !== 'string' ||
    typeof value.muscleGroup !== 'string' ||
    typeof value.instructions !== 'string' ||
    !isNullableString(value.imageUrl) ||
    !isNullableString(value.videoUrl)
  ) {
    return null;
  }

  return {
    id: value.id,
    routineId: value.routineId,
    exerciseId: value.exerciseId,
    sortOrder: value.sortOrder,
    targetSets: value.targetSets,
    targetReps: value.targetReps,
    exerciseName: value.exerciseName,
    muscleGroup: value.muscleGroup,
    instructions: value.instructions,
    imageUrl: value.imageUrl,
    videoUrl: value.videoUrl,
  };
}

function isRoutineKind(value: unknown): value is RoutineDetail['kind'] {
  return value === 'gym' || value === 'home';
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
