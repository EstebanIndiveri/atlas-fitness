import { parseApiErrorBody } from '@/lib/routines/parse-error';
import { isHabitKey } from '@/types/habit';
import type { HabitLog } from '@/lib/db/schema';
import type { ApiError } from '@/types/errors';
import type { HabitKey } from '@/types/habit';

export type HabitLogInput = {
  habitKey: HabitKey;
  done: boolean;
  amount?: string;
};

export type HabitLogResponse = Omit<HabitLog, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type HabitLogClientErrorKind = 'unauthorized' | 'validation' | 'generic';

export class HabitLogClientError extends Error {
  constructor(
    public kind: HabitLogClientErrorKind,
    message: string,
    public status: number,
    public api: ApiError | null = null,
  ) {
    super(message);
    this.name = 'HabitLogClientError';
  }
}

/**
 * Fetches today's habit logs for the authenticated user.
 *
 * @returns The habit log rows for today (empty array when none exist).
 * @throws {HabitLogClientError} When the request fails or the response is invalid.
 * @example
 * const logs = await fetchTodayHabitLogs();
 */
export async function fetchTodayHabitLogs(): Promise<HabitLogResponse[]> {
  const response = await fetch('/api/habits');
  const body = await readBody(response);

  if (!response.ok) {
    throw mapHabitHttpError(response.status, body);
  }

  if (!Array.isArray(body)) {
    throw new HabitLogClientError('generic', 'No se pudieron cargar tus hábitos de hoy', response.status);
  }

  const parsed = body.map(parseHabitLogResponse);
  if (parsed.some((row) => row === null)) {
    throw new HabitLogClientError('generic', 'No se pudieron cargar tus hábitos de hoy', response.status);
  }

  return parsed as HabitLogResponse[];
}

/**
 * Upserts one habit's completion state for today.
 *
 * @param input - The habit key and its new completion state.
 * @returns The habit log row returned by `/api/habits`.
 * @throws {HabitLogClientError} When the request fails or the response is invalid.
 * @example
 * await setHabitLog({ habitKey: 'hydration', done: true });
 */
export async function setHabitLog(input: HabitLogInput): Promise<HabitLogResponse> {
  const response = await fetch('/api/habits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readBody(response);

  if (!response.ok) {
    throw mapHabitHttpError(response.status, body);
  }

  const parsed = parseHabitLogResponse(body);
  if (!parsed) {
    throw new HabitLogClientError('generic', 'No se pudo guardar el hábito', response.status);
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

function mapHabitHttpError(status: number, body: unknown): HabitLogClientError {
  const api = parseApiErrorBody(body);

  if (status === 401 || api?.code === 'UNAUTHORIZED') {
    return new HabitLogClientError('unauthorized', api?.message || 'Autenticación requerida', status, api);
  }

  if (status === 400 || api?.code === 'VALIDATION') {
    return new HabitLogClientError('validation', api?.message || 'Registro de hábito inválido', status, api);
  }

  return new HabitLogClientError('generic', api?.message || 'No se pudieron cargar tus hábitos de hoy', status, api);
}

function parseHabitLogResponse(value: unknown): HabitLogResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const amount = parseNullableAmount(value.amount);
  if (
    !isInteger(value.id) ||
    !isInteger(value.userId) ||
    typeof value.localDate !== 'string' ||
    !isHabitKey(value.habitKey) ||
    typeof value.done !== 'boolean' ||
    amount === INVALID_AMOUNT ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    userId: value.userId,
    localDate: value.localDate,
    habitKey: value.habitKey,
    done: value.done,
    amount,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

const INVALID_AMOUNT = Symbol('invalid-amount');

function parseNullableAmount(value: unknown): string | null | typeof INVALID_AMOUNT {
  if (value === undefined || value === null) {
    return null;
  }
  return typeof value === 'string' ? value : INVALID_AMOUNT;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
