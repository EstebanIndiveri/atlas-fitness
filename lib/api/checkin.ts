import { parseApiErrorBody } from '@/lib/routines/parse-error';
import type { DailyCheckin } from '@/lib/db/schema';
import type { ApiError } from '@/types/errors';

export type CheckInEnergy = 'low' | 'medium' | 'high';
export type DailyCheckInInput = {
  mood: number;
  energy?: CheckInEnergy | null;
  note?: string | null;
};
export type DailyCheckInResponse = Omit<DailyCheckin, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};
export type CheckInClientErrorKind = 'unauthorized' | 'validation' | 'generic';

export class CheckInClientError extends Error {
  constructor(
    public kind: CheckInClientErrorKind,
    message: string,
    public status: number,
    public api: ApiError | null = null,
  ) {
    super(message);
    this.name = 'CheckInClientError';
  }
}

/**
 * Records the authenticated user's full daily check-in.
 *
 * @param input - Mood plus optional energy and note values.
 * @returns The daily check-in row returned by `/api/checkin`.
 * @throws {CheckInClientError} When the request fails or the response is invalid.
 * @example
 * const checkIn = await recordCheckIn({ mood: 4, energy: 'medium', note: 'Buen día.' });
 */
export async function recordCheckIn(input: DailyCheckInInput): Promise<DailyCheckInResponse> {
  const response = await fetch('/api/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readBody(response);

  if (!response.ok) {
    throw mapCheckInHttpError(response.status, body);
  }

  const parsed = parseCheckInResponse(body);
  if (!parsed) {
    throw new CheckInClientError('generic', 'No se pudo registrar el check-in', response.status);
  }

  return parsed;
}

/**
 * Fetches today's full check-in for the authenticated user.
 *
 * @returns Today's daily check-in row, or null when it has not been recorded.
 * @throws {CheckInClientError} When the request fails or the response is invalid.
 * @example
 * const checkIn = await fetchTodayCheckIn();
 */
export async function fetchTodayCheckIn(): Promise<DailyCheckInResponse | null> {
  const response = await fetch('/api/checkin');
  const body = await readBody(response);

  if (!response.ok) {
    throw mapCheckInHttpError(response.status, body);
  }

  if (body === null) {
    return null;
  }

  const parsed = parseCheckInResponse(body);
  if (!parsed) {
    throw new CheckInClientError('generic', 'No se pudo cargar el check-in de hoy', response.status);
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

function mapCheckInHttpError(status: number, body: unknown): CheckInClientError {
  const api = parseApiErrorBody(body);

  if (status === 401 || api?.code === 'UNAUTHORIZED') {
    return new CheckInClientError(
      'unauthorized',
      api?.message || 'Autenticación requerida',
      status,
      api,
    );
  }

  if (status === 400 || api?.code === 'VALIDATION') {
    return new CheckInClientError(
      'validation',
      api?.message || 'Check-in diario inválido',
      status,
      api,
    );
  }

  return new CheckInClientError(
    'generic',
    api?.message || 'No se pudo cargar el check-in de hoy',
    status,
    api,
  );
}

function parseCheckInResponse(value: unknown): DailyCheckInResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isInteger(value.id) ||
    !isInteger(value.userId) ||
    typeof value.localDate !== 'string' ||
    !isInteger(value.mood) ||
    !isEnergyOrNull(value.energy) ||
    !isStringOrNull(value.note) ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    userId: value.userId,
    localDate: value.localDate,
    mood: value.mood,
    energy: value.energy,
    note: value.note,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function isEnergyOrNull(value: unknown): value is CheckInEnergy | null {
  return value === null || value === 'low' || value === 'medium' || value === 'high';
}

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
