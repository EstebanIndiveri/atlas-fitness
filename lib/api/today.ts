import { parseApiErrorBody } from '@/lib/routines/parse-error';
import type { ApiError } from '@/types/errors';
import type { TodayScheduledRoutineResult } from '@/lib/services/training-plan';

export type TodayResponse = TodayScheduledRoutineResult;
export type TodayClientErrorKind = 'unauthorized' | 'generic';

export class TodayClientError extends Error {
  constructor(
    public kind: TodayClientErrorKind,
    message: string,
    public status: number,
    public api: ApiError | null = null,
  ) {
    super(message);
    this.name = 'TodayClientError';
  }
}

/**
 * Fetches the authenticated user's scheduled routine state for today.
 *
 * @returns The data-honest scheduled routine union returned by `/api/today`.
 * @throws {TodayClientError} When the request fails or the response is invalid.
 * @example
 * const today = await fetchToday();
 */
export async function fetchToday(): Promise<TodayResponse> {
  const response = await fetch('/api/today');
  const body = await readBody(response);

  if (!response.ok) {
    throw mapTodayHttpError(response.status, body);
  }

  const parsed = parseTodayResponse(body);
  if (!parsed) {
    throw new TodayClientError('generic', 'No se pudo cargar el plan de hoy', response.status);
  }

  return parsed;
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

function mapTodayHttpError(status: number, body: unknown): TodayClientError {
  const api = parseApiErrorBody(body);
  if (status === 401 || api?.code === 'UNAUTHORIZED') {
    return new TodayClientError(
      'unauthorized',
      api?.message || 'Autenticación requerida',
      status,
      api,
    );
  }

  return new TodayClientError(
    'generic',
    api?.message || 'No se pudo cargar el plan de hoy',
    status,
    api,
  );
}

function parseTodayResponse(value: unknown): TodayResponse | null {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return null;
  }

  if (!hasDateFields(value)) {
    return null;
  }

  switch (value.kind) {
    case 'no_plan':
      return {
        kind: value.kind,
        localDate: value.localDate,
        dayOfWeek: value.dayOfWeek,
      };
    case 'rest_day':
      if (!isInteger(value.trainingPlanId)) {
        return null;
      }
      return {
        kind: value.kind,
        localDate: value.localDate,
        dayOfWeek: value.dayOfWeek,
        trainingPlanId: value.trainingPlanId,
        planGoal: parseNullableString(value.planGoal),
      };
    case 'workout':
      if (
        !isInteger(value.trainingPlanId) ||
        !isInteger(value.scheduledRoutineId) ||
        !isInteger(value.routineId) ||
        typeof value.routineName !== 'string'
      ) {
        return null;
      }
      return {
        kind: value.kind,
        localDate: value.localDate,
        dayOfWeek: value.dayOfWeek,
        trainingPlanId: value.trainingPlanId,
        scheduledRoutineId: value.scheduledRoutineId,
        routineId: value.routineId,
        routineName: value.routineName,
        planGoal: parseNullableString(value.planGoal),
        dayReason: parseNullableString(value.dayReason),
      };
    case 'routine_missing':
      if (
        !isInteger(value.trainingPlanId) ||
        !isInteger(value.scheduledRoutineId) ||
        !isInteger(value.routineId)
      ) {
        return null;
      }
      return {
        kind: value.kind,
        localDate: value.localDate,
        dayOfWeek: value.dayOfWeek,
        trainingPlanId: value.trainingPlanId,
        scheduledRoutineId: value.scheduledRoutineId,
        routineId: value.routineId,
        planGoal: parseNullableString(value.planGoal),
        dayReason: parseNullableString(value.dayReason),
      };
    default:
      return null;
  }
}

function hasDateFields(
  value: Record<string, unknown>,
): value is Record<string, unknown> & { localDate: string; dayOfWeek: TodayResponse['dayOfWeek'] } {
  return typeof value.localDate === 'string' && isDayOfWeek(value.dayOfWeek);
}

function isDayOfWeek(value: unknown): value is TodayResponse['dayOfWeek'] {
  return isInteger(value) && value >= 0 && value <= 6;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function parseNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
