import { ROUTINE_COPY } from '@/lib/copy/routines';
import { mapRoutineHttpError, type MappedRoutineError } from '@/lib/routines/parse-error';
import {
  parseExerciseCatalog,
  parseExerciseCatalogItem,
  parseRoutineList,
  parseRoutineSummary,
} from '@/lib/routines/parse-routine';
import type { ExerciseCatalogItem, UpdateExerciseInput } from '@/types/exercise';
import type { RoutineSummary, RoutineWriteInput } from '@/types/routine';

export class RoutineClientError extends Error {
  constructor(
    public kind: MappedRoutineError['kind'],
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'RoutineClientError';
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function throwMapped(response: Response, method: string): Promise<never> {
  const body = await readBody(response);
  const mapped = mapRoutineHttpError(response.status, body, method);
  throw new RoutineClientError(mapped.kind, mapped.message, response.status);
}

export async function fetchRoutines(): Promise<RoutineSummary[]> {
  const response = await fetch('/api/routines');
  if (!response.ok) {
    await throwMapped(response, 'GET');
  }
  const parsed = parseRoutineList(await readBody(response));
  if (!parsed) {
    throw new RoutineClientError('generic', ROUTINE_COPY.errorLoad, response.status);
  }
  return parsed;
}

export async function fetchRoutine(id: number): Promise<RoutineSummary> {
  const response = await fetch(`/api/routines/${id}`);
  if (!response.ok) {
    await throwMapped(response, 'GET');
  }
  const parsed = parseRoutineSummary(await readBody(response));
  if (!parsed) {
    throw new RoutineClientError('generic', ROUTINE_COPY.errorLoad, response.status);
  }
  return parsed;
}

export async function createRoutine(input: RoutineWriteInput): Promise<RoutineSummary> {
  const response = await fetch('/api/routines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    await throwMapped(response, 'POST');
  }
  const parsed = parseRoutineSummary(await readBody(response));
  if (!parsed) {
    throw new RoutineClientError('generic', ROUTINE_COPY.errorGeneric, response.status);
  }
  return parsed;
}

export async function updateRoutine(id: number, input: RoutineWriteInput): Promise<RoutineSummary> {
  const response = await fetch(`/api/routines/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    await throwMapped(response, 'PATCH');
  }
  const parsed = parseRoutineSummary(await readBody(response));
  if (!parsed) {
    throw new RoutineClientError('generic', ROUTINE_COPY.errorGeneric, response.status);
  }
  return parsed;
}

export async function deleteRoutine(id: number): Promise<void> {
  const response = await fetch(`/api/routines/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    await throwMapped(response, 'DELETE');
  }
}

export async function fetchExercises(): Promise<ExerciseCatalogItem[]> {
  const response = await fetch('/api/exercises');
  if (!response.ok) {
    await throwMapped(response, 'GET');
  }
  const parsed = parseExerciseCatalog(await readBody(response));
  if (!parsed) {
    throw new RoutineClientError('generic', ROUTINE_COPY.errorCatalog, response.status);
  }
  return parsed;
}

export async function patchExerciseMedia(
  id: number,
  input: Pick<UpdateExerciseInput, 'imageUrl' | 'videoUrl'>,
): Promise<ExerciseCatalogItem> {
  const response = await fetch(`/api/exercises/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    await throwMapped(response, 'PATCH');
  }
  const parsed = parseExerciseCatalogItem(await readBody(response));
  if (!parsed) {
    throw new RoutineClientError('generic', ROUTINE_COPY.errorGeneric, response.status);
  }
  return parsed;
}
