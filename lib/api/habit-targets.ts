import { parseApiErrorBody } from '@/lib/routines/parse-error';
import { addLocalDateDays } from '@/lib/time/cordoba';
import { isHabitKey } from '@/types/habit';
import { isHabitTargetWeekday } from '@/types/habit-target';
import type { ApiError } from '@/types/errors';
import type { HabitKey } from '@/types/habit';
import type { HabitTargetWeekday } from '@/types/habit-target';

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_WEEKDAYS = 1;
const MAX_WEEKDAYS = 7;

const FETCH_MESSAGE = 'No se pudieron cargar tus objetivos de hábitos';
const SAVE_MESSAGE = 'No se pudo guardar el objetivo de hábito';
const DEACTIVATE_MESSAGE = 'No se pudo desactivar el objetivo de hábito';
const UNAUTHORIZED_MESSAGE = 'Autenticación requerida';
const VALIDATION_MESSAGE = 'Objetivo de hábito inválido';
const NOT_FOUND_MESSAGE = 'Hábito no encontrado';
const CONFLICT_MESSAGE = 'El objetivo de hábito cambió. Recargá e intentá de nuevo.';

/** Serialized active target returned by the habit-target endpoints. */
export interface HabitTargetResponse {
  id: number;
  userId: number;
  habitKey: HabitKey;
  /** Inclusive Córdoba start date (YYYY-MM-DD). */
  effectiveFrom: string;
  /** Inclusive Córdoba end date (YYYY-MM-DD), or `null` while active. */
  effectiveTo: string | null;
  /** Monotonic compare-and-swap version of the row. */
  version: number;
  /** Selected weekdays, Sunday-first (`0 = Sunday … 6 = Saturday`). */
  weekdays: HabitTargetWeekday[];
  createdAt: string;
  updatedAt: string;
}

/** Create intent: both token halves are `null` (v0.10 brief §9). */
export interface CreateHabitTargetToken {
  expectedTargetId: null;
  expectedVersion: null;
}

/** Update/deactivate token: the `{ id, version }` pair of the target in hand. */
export interface HabitTargetToken {
  expectedTargetId: number;
  expectedVersion: number;
}

/** Accepted write tokens: `null` pair to create, present pair to update. */
export type HabitTargetWriteToken = CreateHabitTargetToken | HabitTargetToken;

/** Post-state of a deactivation; the habit never keeps an active target. */
export interface HabitTargetDeactivationResult {
  activeTarget: null;
}

export type HabitTargetClientErrorKind =
  | 'unauthorized'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'generic';

export class HabitTargetClientError extends Error {
  constructor(
    public kind: HabitTargetClientErrorKind,
    message: string,
    public status: number,
    public api: ApiError | null = null,
  ) {
    super(message);
    this.name = 'HabitTargetClientError';
  }
}

/**
 * Fetches the user's current targets for the fixed catalog, in catalog order.
 *
 * The parser is total: any element that is not exactly a `HabitTargetResponse`
 * — an unknown habit key, an impossible weekday list, a non-canonical date or a
 * mismatched effective range — fails the whole response instead of rendering a
 * partial target (client/server version skew).
 *
 * @returns The current targets returned by `/api/habit-targets` (empty when none).
 * @throws {HabitTargetClientError} When the request fails or the body is invalid.
 * @example
 * const targets = await fetchHabitTargets();
 */
export async function fetchHabitTargets(): Promise<HabitTargetResponse[]> {
  const response = await fetch('/api/habit-targets');
  const body = await readBody(response);

  if (!response.ok) {
    throw mapHabitTargetHttpError(response.status, body, FETCH_MESSAGE);
  }

  if (!Array.isArray(body)) {
    throw new HabitTargetClientError('generic', FETCH_MESSAGE, response.status);
  }

  const targets: HabitTargetResponse[] = [];
  for (const entry of body) {
    const parsed = parseHabitTarget(entry);
    if (!parsed) {
      throw new HabitTargetClientError('generic', FETCH_MESSAGE, response.status);
    }
    targets.push(parsed);
  }

  return targets;
}

/**
 * Creates or updates one habit's weekly target with compare-and-swap.
 *
 * @param habitKey - Closed-catalog habit to configure.
 * @param weekdays - 1–7 distinct Sunday-first weekdays the user expects.
 * @param token - `null` pair to create, or the current `{ id, version }` to update.
 * @returns The active target after the write.
 * @throws {HabitTargetClientError} When the request fails, the token is stale, or the body is invalid.
 * @example
 * await saveHabitTarget('walk', [1, 3], { expectedTargetId: null, expectedVersion: null });
 */
export async function saveHabitTarget(
  habitKey: HabitKey,
  weekdays: readonly HabitTargetWeekday[],
  token: HabitTargetWriteToken,
): Promise<HabitTargetResponse> {
  const response = await fetch(`/api/habit-targets/${habitKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekdays, ...token }),
  });
  const body = await readBody(response);

  if (!response.ok) {
    throw mapHabitTargetHttpError(response.status, body, SAVE_MESSAGE);
  }

  const parsed = parseHabitTarget(body);
  if (!parsed) {
    throw new HabitTargetClientError('generic', SAVE_MESSAGE, response.status);
  }

  return parsed;
}

/**
 * Deactivates one habit's current target without erasing earlier versions.
 *
 * @param habitKey - Closed-catalog habit to deactivate.
 * @param token - Current `{ id, version }` of the target.
 * @returns `{ activeTarget: null }` on success or when already absent.
 * @throws {HabitTargetClientError} When the request fails or the token is stale.
 * @example
 * await deactivateHabitTarget('walk', { expectedTargetId: 7, expectedVersion: 2 });
 */
export async function deactivateHabitTarget(
  habitKey: HabitKey,
  token: HabitTargetToken,
): Promise<HabitTargetDeactivationResult> {
  const response = await fetch(`/api/habit-targets/${habitKey}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(token),
  });
  const body = await readBody(response);

  if (!response.ok) {
    throw mapHabitTargetHttpError(response.status, body, DEACTIVATE_MESSAGE);
  }

  if (!isRecord(body) || body.activeTarget !== null) {
    throw new HabitTargetClientError('generic', DEACTIVATE_MESSAGE, response.status);
  }

  return { activeTarget: null };
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

function mapHabitTargetHttpError(
  status: number,
  body: unknown,
  fallback: string,
): HabitTargetClientError {
  const api = parseApiErrorBody(body);

  if (status === 401 || api?.code === 'UNAUTHORIZED') {
    return new HabitTargetClientError(
      'unauthorized',
      api?.message || UNAUTHORIZED_MESSAGE,
      status,
      api,
    );
  }

  if (status === 400 || api?.code === 'VALIDATION') {
    return new HabitTargetClientError('validation', api?.message || VALIDATION_MESSAGE, status, api);
  }

  if (status === 404 || api?.code === 'NOT_FOUND') {
    return new HabitTargetClientError('not_found', api?.message || NOT_FOUND_MESSAGE, status, api);
  }

  if (status === 409 || api?.code === 'CONFLICT') {
    return new HabitTargetClientError('conflict', api?.message || CONFLICT_MESSAGE, status, api);
  }

  return new HabitTargetClientError('generic', api?.message || fallback, status, api);
}

function parseHabitTarget(value: unknown): HabitTargetResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const weekdays = parseWeekdays(value.weekdays);
  if (
    !isPositiveInteger(value.id) ||
    !isPositiveInteger(value.userId) ||
    !isHabitKey(value.habitKey) ||
    !isCanonicalLocalDate(value.effectiveFrom) ||
    !isNullableCanonicalLocalDate(value.effectiveTo) ||
    (value.effectiveTo !== null && value.effectiveTo < value.effectiveFrom) ||
    !isPositiveInteger(value.version) ||
    !weekdays ||
    !isIsoDateString(value.createdAt) ||
    !isIsoDateString(value.updatedAt)
  ) {
    return null;
  }

  return {
    id: value.id,
    userId: value.userId,
    habitKey: value.habitKey,
    effectiveFrom: value.effectiveFrom,
    effectiveTo: value.effectiveTo,
    version: value.version,
    weekdays,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parseWeekdays(value: unknown): HabitTargetWeekday[] | null {
  if (!Array.isArray(value) || value.length < MIN_WEEKDAYS || value.length > MAX_WEEKDAYS) {
    return null;
  }

  const weekdays: HabitTargetWeekday[] = [];
  for (const entry of value) {
    if (!isHabitTargetWeekday(entry) || weekdays.includes(entry)) {
      return null;
    }
    weekdays.push(entry);
  }

  return weekdays;
}

function isCanonicalLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !LOCAL_DATE_RE.test(value)) {
    return false;
  }

  return addLocalDateDays(value, 0) === value;
}

function isNullableCanonicalLocalDate(value: unknown): value is string | null {
  return value === null || isCanonicalLocalDate(value);
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
