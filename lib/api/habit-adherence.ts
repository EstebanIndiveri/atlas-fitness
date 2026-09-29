import { parseApiErrorBody } from '@/lib/routines/parse-error';
import { addLocalDateDays, sundayFirstLocalDateWeekdayIndex } from '@/lib/time/cordoba';
import { HABIT_KEYS, isHabitKey } from '@/types/habit';
import type { ApiError } from '@/types/errors';
import type { HabitKey } from '@/types/habit';
import type {
  HabitTargetAdherencePeriod,
  HabitTargetAdherenceWindow,
  HabitTargetDay,
  HabitTargetHabitAdherence,
} from '@/types/habit-adherence';
import type {
  HabitTargetConfigurationState,
  HabitTargetDayState,
  HabitTargetHabitConfigurationState,
} from '@/types/habit-target';

const PERIODS: readonly HabitTargetAdherencePeriod[] = ['week', 'month', 'quarter'];
const CONFIGURATION_STATES: readonly HabitTargetConfigurationState[] = [
  'not_configured',
  'partially_configured',
  'configured',
];
const HABIT_CONFIGURATION_STATES: readonly HabitTargetHabitConfigurationState[] = [
  'not_configured',
  'configured',
];
const METRIC_STATES = ['no_expected_days', 'result'] as const;
const DAY_STATES: readonly HabitTargetDayState[] = [
  'future_expected',
  'expected_completed',
  'expected_unrecorded',
  'extra_recorded',
  'not_expected',
];

const UNAUTHORIZED_MESSAGE = 'Autenticación requerida';
const VALIDATION_MESSAGE = 'Período de cumplimiento de hábitos inválido';
const GENERIC_MESSAGE = 'No se pudo cargar tu cumplimiento de hábitos';

export type HabitTargetAdherenceClientErrorKind = 'unauthorized' | 'validation' | 'generic';

export class HabitTargetAdherenceClientError extends Error {
  constructor(
    public kind: HabitTargetAdherenceClientErrorKind,
    message: string,
    public status: number,
    public api: ApiError | null = null,
  ) {
    super(message);
    this.name = 'HabitTargetAdherenceClientError';
  }
}

/**
 * Fetches target adherence for one Córdoba window.
 *
 * The parser is total and honest: it accepts a window only when catalog keys,
 * dates, counts, ratio and daily states are all internally possible, and it
 * always preserves the `N de M` counts rather than trusting a percentage. An
 * unknown habit key, a missing catalog key, a non-contiguous day list, a
 * completed count above the denominator, or a percentage that does not match
 * `round(100 * completed / expected)` all fail the response instead of rendering
 * a plausible-looking lie (v0.10 brief §7).
 *
 * @param period - Córdoba window to read: current week, last 30 days, or last 90 days.
 * @returns The adherence window returned by `/api/stats/habit-adherence`.
 * @throws {HabitTargetAdherenceClientError} When the request fails or the body is invalid.
 * @example
 * const window = await fetchHabitTargetAdherence('month');
 */
export async function fetchHabitTargetAdherence(
  period: HabitTargetAdherencePeriod,
): Promise<HabitTargetAdherenceWindow> {
  const response = await fetch(`/api/stats/habit-adherence?period=${period}`);
  const body = await readBody(response);

  if (!response.ok) {
    throw mapAdherenceHttpError(response.status, body);
  }

  const parsed = parseAdherenceWindow(body);
  if (!parsed) {
    throw new HabitTargetAdherenceClientError('generic', GENERIC_MESSAGE, response.status);
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

function mapAdherenceHttpError(status: number, body: unknown): HabitTargetAdherenceClientError {
  const api = parseApiErrorBody(body);

  if (status === 401 || api?.code === 'UNAUTHORIZED') {
    return new HabitTargetAdherenceClientError(
      'unauthorized',
      api?.message || UNAUTHORIZED_MESSAGE,
      status,
      api,
    );
  }

  if (status === 400 || api?.code === 'VALIDATION') {
    return new HabitTargetAdherenceClientError(
      'validation',
      api?.message || VALIDATION_MESSAGE,
      status,
      api,
    );
  }

  return new HabitTargetAdherenceClientError('generic', api?.message || GENERIC_MESSAGE, status, api);
}

/** Counts and ratio always travel together; the ratio is derived, never trusted blindly. */
interface AdherenceCounts {
  expectedHabitDays: number;
  completedExpectedHabitDays: number;
  extraRecordedHabitDays: number;
  adherencePercent: number | null;
}

function parseAdherenceWindow(value: unknown): HabitTargetAdherenceWindow | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isPeriod(value.period) ||
    !isCanonicalLocalDate(value.windowStart) ||
    !isCanonicalLocalDate(value.windowEnd) ||
    !isCanonicalLocalDate(value.today) ||
    value.windowStart > value.windowEnd ||
    value.today < value.windowStart ||
    value.today > value.windowEnd ||
    !CONFIGURATION_STATES.includes(value.configurationState as HabitTargetConfigurationState) ||
    !METRIC_STATES.includes(value.metricState as (typeof METRIC_STATES)[number])
  ) {
    return null;
  }

  const totals = parseAdherenceCounts(value);
  const perHabit = parsePerHabit(value.perHabit);
  const days = parseDays(value.days, value.windowStart, value.windowEnd, value.today);

  if (!totals || !perHabit || !days) {
    return null;
  }

  if (
    sumPerHabit(perHabit, 'expectedHabitDays') !== totals.expectedHabitDays ||
    sumPerHabit(perHabit, 'completedExpectedHabitDays') !== totals.completedExpectedHabitDays ||
    sumPerHabit(perHabit, 'extraRecordedHabitDays') !== totals.extraRecordedHabitDays
  ) {
    return null;
  }

  const configuredCount = HABIT_KEYS.filter(
    (habitKey) => perHabit[habitKey].configurationState === 'configured',
  ).length;

  if (resolveConfigurationState(configuredCount) !== value.configurationState) {
    return null;
  }

  if ((totals.expectedHabitDays > 0) !== (value.metricState === 'result')) {
    return null;
  }

  return {
    period: value.period,
    windowStart: value.windowStart,
    windowEnd: value.windowEnd,
    today: value.today,
    configurationState: value.configurationState as HabitTargetConfigurationState,
    metricState: value.metricState as (typeof METRIC_STATES)[number],
    ...totals,
    perHabit,
    days,
  };
}

function parsePerHabit(value: unknown): Record<HabitKey, HabitTargetHabitAdherence> | null {
  if (!isRecord(value) || Object.keys(value).some((key) => !isHabitKey(key))) {
    return null;
  }

  const perHabit = {} as Record<HabitKey, HabitTargetHabitAdherence>;
  for (const habitKey of HABIT_KEYS) {
    const entry = value[habitKey];
    if (!isRecord(entry)) {
      return null;
    }
    if (
      !HABIT_CONFIGURATION_STATES.includes(
        entry.configurationState as HabitTargetHabitConfigurationState,
      ) ||
      !METRIC_STATES.includes(entry.metricState as (typeof METRIC_STATES)[number])
    ) {
      return null;
    }

    const counts = parseAdherenceCounts(entry);
    if (!counts || (counts.expectedHabitDays > 0) !== (entry.metricState === 'result')) {
      return null;
    }

    perHabit[habitKey] = {
      configurationState: entry.configurationState as HabitTargetHabitConfigurationState,
      metricState: entry.metricState as (typeof METRIC_STATES)[number],
      ...counts,
    };
  }

  return perHabit;
}

function parseAdherenceCounts(record: Record<string, unknown>): AdherenceCounts | null {
  const expected = record.expectedHabitDays;
  const completed = record.completedExpectedHabitDays;
  const extra = record.extraRecordedHabitDays;

  if (!isNonNegativeInteger(expected)) {
    return null;
  }
  if (!isNonNegativeInteger(completed) || completed > expected) {
    return null;
  }
  if (!isNonNegativeInteger(extra)) {
    return null;
  }
  if (!isConsistentPercent(record.adherencePercent, completed, expected)) {
    return null;
  }

  return {
    expectedHabitDays: expected,
    completedExpectedHabitDays: completed,
    extraRecordedHabitDays: extra,
    adherencePercent: expected === 0 ? null : (record.adherencePercent as number),
  };
}

function parseDays(
  value: unknown,
  windowStart: string,
  windowEnd: string,
  today: string,
): HabitTargetDay[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const days: HabitTargetDay[] = [];
  let expectedDate = windowStart;

  for (const entry of value) {
    if (!isRecord(entry) || entry.localDate !== expectedDate) {
      return null;
    }
    if (
      entry.weekday !== sundayFirstLocalDateWeekdayIndex(expectedDate) ||
      typeof entry.isToday !== 'boolean' ||
      typeof entry.isFuture !== 'boolean' ||
      entry.isToday !== (expectedDate === today) ||
      entry.isFuture !== (expectedDate > today)
    ) {
      return null;
    }

    const habitStates = parseHabitStates(entry.habitStates);
    if (!habitStates) {
      return null;
    }

    days.push({
      localDate: expectedDate,
      weekday: entry.weekday as HabitTargetDay['weekday'],
      isToday: entry.isToday,
      isFuture: entry.isFuture,
      habitStates,
    });
    expectedDate = addLocalDateDays(expectedDate, 1);
  }

  return days[days.length - 1].localDate === windowEnd ? days : null;
}

function parseHabitStates(value: unknown): Record<HabitKey, HabitTargetDayState> | null {
  if (!isRecord(value) || Object.keys(value).some((key) => !isHabitKey(key))) {
    return null;
  }

  const states = {} as Record<HabitKey, HabitTargetDayState>;
  for (const habitKey of HABIT_KEYS) {
    const state = value[habitKey];
    if (typeof state !== 'string' || !DAY_STATES.includes(state as HabitTargetDayState)) {
      return null;
    }
    states[habitKey] = state as HabitTargetDayState;
  }

  return states;
}

/** Only `round(100 * completed / expected)` is possible; zero denominator means no ratio. */
function isConsistentPercent(value: unknown, completed: number, expected: number): boolean {
  if (expected === 0) {
    return value === null;
  }

  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value === Math.round((100 * completed) / expected)
  );
}

function sumPerHabit(
  perHabit: Record<HabitKey, HabitTargetHabitAdherence>,
  field: 'expectedHabitDays' | 'completedExpectedHabitDays' | 'extraRecordedHabitDays',
): number {
  return HABIT_KEYS.reduce((total, habitKey) => total + perHabit[habitKey][field], 0);
}

function resolveConfigurationState(configuredCount: number): HabitTargetConfigurationState {
  if (configuredCount === 0) {
    return 'not_configured';
  }

  return configuredCount >= HABIT_KEYS.length ? 'configured' : 'partially_configured';
}

function isPeriod(value: unknown): value is HabitTargetAdherencePeriod {
  return PERIODS.some((period) => period === value);
}

function isCanonicalLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return addLocalDateDays(value, 0) === value;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
