import { parseApiErrorBody } from '@/lib/routines/parse-error';
import { HABIT_KEYS, isHabitKey } from '@/types/habit';
import type { ApiError } from '@/types/errors';
import type { HabitActivityDay, HabitActivityPeriod, HabitActivityWindow } from '@/types/habit-activity';
import type { HabitKey } from '@/types/habit';

const HABIT_ACTIVITY_PERIODS: readonly HabitActivityPeriod[] = ['week', 'month', 'quarter'];
const MAX_WEEKDAY_INDEX = 6;
const GENERIC_MESSAGE = 'No se pudo cargar tu actividad de hábitos';
const UNAUTHORIZED_MESSAGE = 'Autenticación requerida';
const VALIDATION_MESSAGE = 'Período de actividad de hábitos inválido';

export type HabitActivityClientErrorKind = 'unauthorized' | 'validation' | 'generic';

export class HabitActivityClientError extends Error {
  constructor(
    public kind: HabitActivityClientErrorKind,
    message: string,
    public status: number,
    public api: ApiError | null = null,
  ) {
    super(message);
    this.name = 'HabitActivityClientError';
  }
}

/**
 * Fetches the habit activity window for the authenticated user.
 *
 * The window is read-only derived data: the client never computes, adjusts, or
 * re-derives counts. Any body that does not match `HabitActivityWindow` exactly — including
 * a habit key outside the catalog — is rejected instead of rendered partially, because that
 * signals a client/server version skew.
 *
 * @param period - Córdoba window to read: the current week, the last 30 days, or the last 90 days.
 * @returns The habit activity window returned by `/api/stats/habits`.
 * @throws {HabitActivityClientError} When the request fails or the response is invalid.
 * @example
 * const window = await fetchHabitActivity('month');
 */
export async function fetchHabitActivity(period: HabitActivityPeriod): Promise<HabitActivityWindow> {
  const response = await fetch(`/api/stats/habits?period=${period}`);
  const body = await readBody(response);

  if (!response.ok) {
    throw mapHabitActivityHttpError(response.status, body);
  }

  const parsed = parseHabitActivityWindow(body);
  if (!parsed) {
    throw new HabitActivityClientError('generic', GENERIC_MESSAGE, response.status);
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

function mapHabitActivityHttpError(status: number, body: unknown): HabitActivityClientError {
  const api = parseApiErrorBody(body);

  if (status === 401 || api?.code === 'UNAUTHORIZED') {
    return new HabitActivityClientError(
      'unauthorized',
      api?.message || UNAUTHORIZED_MESSAGE,
      status,
      api,
    );
  }

  if (status === 400 || api?.code === 'VALIDATION') {
    return new HabitActivityClientError('validation', api?.message || VALIDATION_MESSAGE, status, api);
  }

  return new HabitActivityClientError('generic', api?.message || GENERIC_MESSAGE, status, api);
}

function parseHabitActivityWindow(value: unknown): HabitActivityWindow | null {
  if (!isRecord(value)) {
    return null;
  }

  const perHabit = parsePerHabit(value.perHabit);
  const days = parseDays(value.days);
  if (
    !isHabitActivityPeriod(value.period) ||
    typeof value.windowStart !== 'string' ||
    typeof value.windowEnd !== 'string' ||
    !isInteger(value.elapsedDays) ||
    !isInteger(value.activeDays) ||
    !isInsightStatus(value.insightStatus) ||
    !isInteger(value.insightMinimumElapsedDays) ||
    !perHabit ||
    !days
  ) {
    return null;
  }

  return {
    period: value.period,
    windowStart: value.windowStart,
    windowEnd: value.windowEnd,
    elapsedDays: value.elapsedDays,
    activeDays: value.activeDays,
    perHabit,
    days,
    insightStatus: value.insightStatus,
    insightMinimumElapsedDays: value.insightMinimumElapsedDays,
  };
}

/**
 * Reads the per-habit counts, requiring the whole catalog exactly once.
 *
 * A missing catalog key would silently under-report the window, and an unknown key is a
 * version-skew signal; both fail the parse instead of degrading the rendered card.
 */
function parsePerHabit(value: unknown): Record<HabitKey, { activeDays: number }> | null {
  if (!isRecord(value)) {
    return null;
  }

  if (Object.keys(value).some((key) => !isHabitKey(key))) {
    return null;
  }

  const activeDaysByKey: Partial<Record<HabitKey, { activeDays: number }>> = {};
  for (const habitKey of HABIT_KEYS) {
    const entry = value[habitKey];
    if (!isRecord(entry) || !isInteger(entry.activeDays)) {
      return null;
    }
    activeDaysByKey[habitKey] = { activeDays: entry.activeDays };
  }

  return activeDaysByKey as Record<HabitKey, { activeDays: number }>;
}

function parseDays(value: unknown): HabitActivityDay[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const days: HabitActivityDay[] = [];
  for (const entry of value) {
    const day = parseDay(entry);
    if (!day) {
      return null;
    }
    days.push(day);
  }

  return days;
}

function parseDay(value: unknown): HabitActivityDay | null {
  if (!isRecord(value) || !Array.isArray(value.recordedKeys)) {
    return null;
  }

  const recordedKeys: HabitKey[] = [];
  for (const habitKey of value.recordedKeys) {
    if (!isHabitKey(habitKey)) {
      return null;
    }
    recordedKeys.push(habitKey);
  }

  if (
    typeof value.localDate !== 'string' ||
    !isWeekdayIndex(value.weekdayIndex) ||
    typeof value.isToday !== 'boolean' ||
    typeof value.isFuture !== 'boolean' ||
    typeof value.isRecorded !== 'boolean'
  ) {
    return null;
  }

  return {
    localDate: value.localDate,
    weekdayIndex: value.weekdayIndex,
    isToday: value.isToday,
    isFuture: value.isFuture,
    recordedKeys,
    isRecorded: value.isRecorded,
  };
}

function isHabitActivityPeriod(value: unknown): value is HabitActivityPeriod {
  return HABIT_ACTIVITY_PERIODS.some((period) => period === value);
}

function isInsightStatus(value: unknown): value is HabitActivityWindow['insightStatus'] {
  return value === 'available' || value === 'insufficient';
}

function isWeekdayIndex(value: unknown): value is number {
  return isInteger(value) && value >= 0 && value <= MAX_WEEKDAY_INDEX;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
