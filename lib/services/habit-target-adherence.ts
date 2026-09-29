import {
  addLocalDateDays,
  localDateWeekdayIndex,
  sundayFirstLocalDateWeekdayIndex,
} from '@/lib/time/cordoba';
import { HABIT_KEYS, isHabitKey } from '@/types/habit';
import { isHabitTargetWeekday } from '@/types/habit-target';
import type {
  ExpectedHabitDay,
  HabitTargetAdherenceInput,
  HabitTargetAdherencePeriod,
  HabitTargetAdherenceWindow,
  HabitTargetDay,
  HabitTargetHabitAdherence,
  HabitTargetLogEntry,
  ResolveExpectedHabitDaysInput,
} from '@/types/habit-adherence';
import type { HabitKey } from '@/types/habit';
import type {
  HabitTargetConfigurationState,
  HabitTargetDayState,
  HabitTargetScheduleVersion,
  HabitTargetWeekday,
} from '@/types/habit-target';

interface HabitTargetWindowBounds {
  windowStart: string;
  windowEnd: string;
}

interface HabitTargetInterval {
  effectiveFrom: string;
  effectiveTo: string | null;
}

interface HabitTargetAccumulator {
  expectedHabitDays: number;
  completedExpectedHabitDays: number;
  extraRecordedHabitDays: number;
}

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_WINDOW_DAYS = 30;
const QUARTER_WINDOW_DAYS = 90;

/**
 * True only for a real Córdoba calendar day in YYYY-MM-DD form.
 *
 * Shape validation alone accepts impossible days such as `2026-02-31`; the
 * round-trip through `addLocalDateDays` canonicalises the value, so any
 * non-existent day fails and can never corrupt lexicographic date comparisons.
 */
function isCanonicalLocalDate(value: string): boolean {
  if (!LOCAL_DATE_RE.test(value)) {
    return false;
  }
  return addLocalDateDays(value, 0) === value;
}

function assertCanonicalLocalDate(value: string, label: string): void {
  if (!isCanonicalLocalDate(value)) {
    throw new Error(`Invalid ${label} date: ${value}`);
  }
}

/**
 * Resolves the inclusive Córdoba bounds of a target-adherence window for a
 * reference day.
 *
 * Windows are Monday-first and include the reference day, identical to the
 * v0.9 habit-activity windows: `week` is the current Monday-first week (which
 * may extend into the future and is then filtered by the caller), `month` the
 * last 30 days, `quarter` the last 90 days. The Monday-first helper is used
 * only for window bounds; weekday matching uses the Sunday-first helper.
 */
function resolveHabitTargetWindow(
  period: HabitTargetAdherencePeriod,
  today: string,
): HabitTargetWindowBounds {
  const canonicalToday = addLocalDateDays(today, 0);

  if (canonicalToday !== today) {
    throw new Error(`Invalid today date: ${today}`);
  }

  if (period === 'week') {
    const windowStart = addLocalDateDays(canonicalToday, -localDateWeekdayIndex(canonicalToday));

    return { windowStart, windowEnd: addLocalDateDays(windowStart, 6) };
  }

  if (period === 'month') {
    return {
      windowStart: addLocalDateDays(canonicalToday, -(MONTH_WINDOW_DAYS - 1)),
      windowEnd: canonicalToday,
    };
  }

  if (period === 'quarter') {
    return {
      windowStart: addLocalDateDays(canonicalToday, -(QUARTER_WINDOW_DAYS - 1)),
      windowEnd: canonicalToday,
    };
  }

  throw new Error(`Unsupported habit target period: ${String(period)}`);
}

/** Narrows the calendar weekday to the Sunday-first contract, guarding `getUTCDay`. */
function resolveWeekday(localDate: string): HabitTargetWeekday {
  const weekday = sundayFirstLocalDateWeekdayIndex(localDate);

  if (!isHabitTargetWeekday(weekday)) {
    throw new Error(`Invalid weekday index: ${weekday}`);
  }

  return weekday;
}

/**
 * Validates the invariants of a set of schedule versions, purely and
 * order-independently, and throws on the first violation.
 *
 * Enforced: known habit key; real Córdoba effective dates; `effectiveTo` not
 * before `effectiveFrom`; positive integer version; 1–7 distinct Sunday-first
 * weekdays; and no overlapping effective intervals per habit. Adjacent
 * intervals (one starting the day after another ends) are allowed.
 *
 * @param schedules - Schedule versions, in any order, from an untrusted boundary.
 * @throws {Error} When any invariant is violated.
 * @example
 * assertValidHabitTargetSchedules([{ habitKey: 'walk', effectiveFrom: '2026-09-01', effectiveTo: null, version: 1, weekdays: [1, 3] }]);
 */
export function assertValidHabitTargetSchedules(
  schedules: readonly HabitTargetScheduleVersion[],
): void {
  const intervalsByHabit = new Map<HabitKey, HabitTargetInterval[]>();

  for (const schedule of schedules) {
    if (!isHabitKey(schedule.habitKey)) {
      throw new Error(`Unknown habit key: ${String(schedule.habitKey)}`);
    }

    assertCanonicalLocalDate(schedule.effectiveFrom, 'effectiveFrom');

    if (schedule.effectiveTo !== null) {
      assertCanonicalLocalDate(schedule.effectiveTo, 'effectiveTo');

      if (schedule.effectiveTo < schedule.effectiveFrom) {
        throw new Error(
          `effectiveTo before effectiveFrom for ${schedule.habitKey}: ${schedule.effectiveFrom}..${schedule.effectiveTo}`,
        );
      }
    }

    if (!Number.isInteger(schedule.version) || schedule.version < 1) {
      throw new Error(`Invalid schedule version: ${String(schedule.version)}`);
    }

    if (schedule.weekdays.length < 1 || schedule.weekdays.length > 7) {
      throw new Error('A schedule must select between 1 and 7 weekdays');
    }

    const seenWeekdays = new Set<HabitTargetWeekday>();

    for (const weekday of schedule.weekdays) {
      if (!isHabitTargetWeekday(weekday)) {
        throw new Error(`Invalid weekday: ${String(weekday)}`);
      }

      if (seenWeekdays.has(weekday)) {
        throw new Error(`Duplicate weekday: ${weekday}`);
      }

      seenWeekdays.add(weekday);
    }

    const intervals = intervalsByHabit.get(schedule.habitKey);
    const interval: HabitTargetInterval = {
      effectiveFrom: schedule.effectiveFrom,
      effectiveTo: schedule.effectiveTo,
    };

    if (intervals === undefined) {
      intervalsByHabit.set(schedule.habitKey, [interval]);
    } else {
      intervals.push(interval);
    }
  }

  for (const [habitKey, intervals] of intervalsByHabit) {
    const sorted = [...intervals].sort((left, right) =>
      left.effectiveFrom < right.effectiveFrom
        ? -1
        : left.effectiveFrom > right.effectiveFrom
          ? 1
          : 0,
    );

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];

      if (previous === undefined || current === undefined) {
        continue;
      }

      if (previous.effectiveTo === null || current.effectiveFrom <= previous.effectiveTo) {
        throw new Error(`Overlapping habit target schedules for ${habitKey}`);
      }
    }
  }
}

/** Indexes versions by habit, each list sorted ascending by `effectiveFrom`. */
function indexSchedulesByHabit(
  schedules: readonly HabitTargetScheduleVersion[],
): Map<HabitKey, HabitTargetScheduleVersion[]> {
  const byHabit = new Map<HabitKey, HabitTargetScheduleVersion[]>();

  for (const schedule of schedules) {
    const versions = byHabit.get(schedule.habitKey);

    if (versions === undefined) {
      byHabit.set(schedule.habitKey, [schedule]);
    } else {
      versions.push(schedule);
    }
  }

  for (const versions of byHabit.values()) {
    versions.sort((left, right) =>
      left.effectiveFrom < right.effectiveFrom
        ? -1
        : left.effectiveFrom > right.effectiveFrom
          ? 1
          : 0,
    );
  }

  return byHabit;
}

/** Finds the single version effective on a date, treating `null` end as open-ended. */
function findEffectiveVersion(
  versions: readonly HabitTargetScheduleVersion[] | undefined,
  localDate: string,
): HabitTargetScheduleVersion | undefined {
  if (versions === undefined) {
    return undefined;
  }

  return versions.find(
    (version) =>
      version.effectiveFrom <= localDate &&
      (version.effectiveTo === null || localDate <= version.effectiveTo),
  );
}

/** True when a version is effective on the date and selects its weekday. */
function isExpectedOn(
  versions: readonly HabitTargetScheduleVersion[] | undefined,
  localDate: string,
  weekday: HabitTargetWeekday,
): boolean {
  const version = findEffectiveVersion(versions, localDate);

  return version !== undefined && version.weekdays.includes(weekday);
}

/** Indexes `done === true` catalog logs by date in a single pass. */
function indexRecordedKeysByDate(
  logs: readonly HabitTargetLogEntry[],
): Map<string, Set<HabitKey>> {
  const recordedKeysByDate = new Map<string, Set<HabitKey>>();

  for (const entry of logs) {
    if (entry.done !== true || !isHabitKey(entry.habitKey)) {
      continue;
    }

    const recordedKeys = recordedKeysByDate.get(entry.localDate);

    if (recordedKeys === undefined) {
      recordedKeysByDate.set(entry.localDate, new Set([entry.habitKey]));
    } else {
      recordedKeys.add(entry.habitKey);
    }
  }

  return recordedKeysByDate;
}

/** Zeroes one accumulator per catalog habit, in catalog order. */
function createAccumulators(): Record<HabitKey, HabitTargetAccumulator> {
  const accumulators = {} as Record<HabitKey, HabitTargetAccumulator>;

  for (const habitKey of HABIT_KEYS) {
    accumulators[habitKey] = {
      expectedHabitDays: 0,
      completedExpectedHabitDays: 0,
      extraRecordedHabitDays: 0,
    };
  }

  return accumulators;
}

/** `round(100 * completed / expected)` only when the denominator is positive. */
function computeAdherencePercent(completed: number, expected: number): number | null {
  if (expected <= 0) {
    return null;
  }

  return Math.round((100 * completed) / expected);
}

/** Maps the number of configured catalog habits to the global configuration state. */
function resolveConfigurationState(configuredCount: number): HabitTargetConfigurationState {
  if (configuredCount === 0) {
    return 'not_configured';
  }

  return configuredCount >= HABIT_KEYS.length ? 'configured' : 'partially_configured';
}

/**
 * Resolves every expected habit-day of an inclusive Córdoba date interval.
 *
 * A habit-day is expected only when a schedule version is effective on the date
 * (inclusive `effectiveFrom`/`effectiveTo`, `null` open-ended) AND the date's
 * Sunday-first weekday is selected by that version. Versions are chosen per date,
 * so earlier dates keep their historical interpretation. Output is ordered by
 * ascending date, then catalog order, and is deterministic regardless of input
 * schedule order.
 *
 * @param input - Schedule versions plus the inclusive start/end dates.
 * @returns Expected habit-days, ascending by date then catalog order.
 * @throws {Error} When a date is invalid, `end` precedes `start`, or a schedule violates an invariant.
 * @example
 * resolveExpectedHabitDays({ schedules, start: '2026-09-21', end: '2026-09-27' });
 */
export function resolveExpectedHabitDays(input: ResolveExpectedHabitDaysInput): ExpectedHabitDay[] {
  assertCanonicalLocalDate(input.start, 'start');
  assertCanonicalLocalDate(input.end, 'end');

  if (input.end < input.start) {
    throw new Error(`Invalid date range: end before start (${input.start}..${input.end})`);
  }

  assertValidHabitTargetSchedules(input.schedules);

  const versionsByHabit = indexSchedulesByHabit(input.schedules);
  const expectedHabitDays: ExpectedHabitDay[] = [];
  let localDate = input.start;

  while (localDate <= input.end) {
    const weekday = resolveWeekday(localDate);

    for (const habitKey of HABIT_KEYS) {
      if (isExpectedOn(versionsByHabit.get(habitKey), localDate, weekday)) {
        expectedHabitDays.push({ localDate, habitKey, weekday });
      }
    }

    localDate = addLocalDateDays(localDate, 1);
  }

  return expectedHabitDays;
}

/**
 * Computes honest target adherence for one Córdoba window, purely and
 * deterministically.
 *
 * The denominator counts only expected habit-days that have elapsed on or before
 * `today`; future expected days are rendered `future_expected` but never counted.
 * A `done === true` log is the only completion signal, and a completion on a
 * non-expected day is `extra_recorded` without moving either count. Each habit
 * on each date is one habit-day, so two habits expected the same date count as
 * two. When the denominator is zero the metric state is `no_expected_days` and
 * no per-cent is emitted (never `NaN`, `Infinity`, or a synthetic 0%).
 *
 * `configurationState` (whether a version is effective today) is independent
 * from `metricState` (whether the window has elapsed expected days): an ended
 * schedule can be `not_configured` while still producing a historical result.
 *
 * @param input - Window period, clock-resolved Córdoba day, schedules, and logs.
 * @returns The target-adherence window, days ordered ascending.
 * @throws {Error} When `period`/`today` is invalid or a schedule violates an invariant.
 * @example
 * computeHabitTargetAdherence({ period: 'week', today: '2026-09-24', schedules, logs });
 */
export function computeHabitTargetAdherence(
  input: HabitTargetAdherenceInput,
): HabitTargetAdherenceWindow {
  const bounds = resolveHabitTargetWindow(input.period, input.today);
  assertValidHabitTargetSchedules(input.schedules);

  const versionsByHabit = indexSchedulesByHabit(input.schedules);
  const recordedKeysByDate = indexRecordedKeysByDate(input.logs);
  const accumulators = createAccumulators();
  const days: HabitTargetDay[] = [];
  let localDate = bounds.windowStart;

  while (localDate <= bounds.windowEnd) {
    const isFuture = localDate > input.today;
    const isToday = localDate === input.today;
    const weekday = resolveWeekday(localDate);
    const recordedKeys = recordedKeysByDate.get(localDate);
    const habitStates = {} as Record<HabitKey, HabitTargetDayState>;

    for (const habitKey of HABIT_KEYS) {
      const isExpected = isExpectedOn(versionsByHabit.get(habitKey), localDate, weekday);
      const isCompleted = recordedKeys?.has(habitKey) ?? false;
      let state: HabitTargetDayState;

      if (isFuture) {
        state = isExpected ? 'future_expected' : 'not_expected';
      } else if (isExpected && isCompleted) {
        state = 'expected_completed';
      } else if (isExpected) {
        state = 'expected_unrecorded';
      } else if (isCompleted) {
        state = 'extra_recorded';
      } else {
        state = 'not_expected';
      }

      habitStates[habitKey] = state;

      if (isFuture) {
        continue;
      }

      const accumulator = accumulators[habitKey];

      if (isExpected) {
        accumulator.expectedHabitDays += 1;

        if (isCompleted) {
          accumulator.completedExpectedHabitDays += 1;
        }
      } else if (isCompleted) {
        accumulator.extraRecordedHabitDays += 1;
      }
    }

    days.push({ localDate, weekday, isToday, isFuture, habitStates });
    localDate = addLocalDateDays(localDate, 1);
  }

  const perHabit = {} as Record<HabitKey, HabitTargetHabitAdherence>;
  let expectedHabitDays = 0;
  let completedExpectedHabitDays = 0;
  let extraRecordedHabitDays = 0;
  let configuredCount = 0;

  for (const habitKey of HABIT_KEYS) {
    const accumulator = accumulators[habitKey];
    const isActiveToday =
      findEffectiveVersion(versionsByHabit.get(habitKey), input.today) !== undefined;

    if (isActiveToday) {
      configuredCount += 1;
    }

    expectedHabitDays += accumulator.expectedHabitDays;
    completedExpectedHabitDays += accumulator.completedExpectedHabitDays;
    extraRecordedHabitDays += accumulator.extraRecordedHabitDays;

    perHabit[habitKey] = {
      configurationState: isActiveToday ? 'configured' : 'not_configured',
      metricState: accumulator.expectedHabitDays > 0 ? 'result' : 'no_expected_days',
      expectedHabitDays: accumulator.expectedHabitDays,
      completedExpectedHabitDays: accumulator.completedExpectedHabitDays,
      extraRecordedHabitDays: accumulator.extraRecordedHabitDays,
      adherencePercent: computeAdherencePercent(
        accumulator.completedExpectedHabitDays,
        accumulator.expectedHabitDays,
      ),
    };
  }

  return {
    period: input.period,
    windowStart: bounds.windowStart,
    windowEnd: bounds.windowEnd,
    today: input.today,
    configurationState: resolveConfigurationState(configuredCount),
    metricState: expectedHabitDays > 0 ? 'result' : 'no_expected_days',
    expectedHabitDays,
    completedExpectedHabitDays,
    extraRecordedHabitDays,
    adherencePercent: computeAdherencePercent(completedExpectedHabitDays, expectedHabitDays),
    perHabit,
    days,
  };
}
