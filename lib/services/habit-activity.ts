import { loadHabitActivityInWindow } from '@/lib/services/habit-logs';
import { addLocalDateDays, cordobaLocalDate, localDateWeekdayIndex } from '@/lib/time/cordoba';
import { HABIT_KEYS, isHabitKey } from '@/types/habit';
import { INSIGHT_MINIMUM_ELAPSED_DAYS } from '@/types/habit-activity';
import type {
  HabitActivityDay,
  HabitActivityInput,
  HabitActivityLogEntry,
  HabitActivityPeriod,
  HabitActivityWindow,
} from '@/types/habit-activity';
import type { HabitKey } from '@/types/habit';

interface HabitActivityWindowBounds {
  windowStart: string;
  windowEnd: string;
}

const MONTH_WINDOW_DAYS = 30;
const QUARTER_WINDOW_DAYS = 90;

/**
 * Resolves the inclusive Córdoba bounds of a habit-activity window for a reference day.
 *
 * Windows are Monday-first and include the reference day: `week` is the current week
 * (identical derivation to `computeWeekConsistency`), `month` the last 30 days, `quarter`
 * the last 90 days (identical offsets to `progress-summary`'s window of the same name).
 * Pure and clock-free, so the loader and the pure core always agree by construction.
 *
 * @param period - Window to resolve.
 * @param today - Córdoba calendar date (YYYY-MM-DD) of the reference instant.
 * @returns Inclusive window bounds, both Córdoba YYYY-MM-DD strings.
 * @throws {Error} When `period` is not a supported period, or `today` is not a valid Córdoba date.
 * @example
 * resolveHabitActivityWindow('week', '2026-09-24'); // { windowStart: '2026-09-21', windowEnd: '2026-09-27' }
 */
function resolveHabitActivityWindow(
  period: HabitActivityPeriod,
  today: string,
): HabitActivityWindowBounds {
  if (period === 'week') {
    const windowStart = addLocalDateDays(today, -localDateWeekdayIndex(today));

    return { windowStart, windowEnd: addLocalDateDays(windowStart, 6) };
  }

  if (period === 'month') {
    return { windowStart: addLocalDateDays(today, -(MONTH_WINDOW_DAYS - 1)), windowEnd: today };
  }

  if (period === 'quarter') {
    return { windowStart: addLocalDateDays(today, -(QUARTER_WINDOW_DAYS - 1)), windowEnd: today };
  }

  throw new Error(`Unsupported habit activity period: ${period}`);
}

/**
 * Indexes catalog habits with `done === true` by Córdoba date in a single pass.
 *
 * Logs for dates outside the window are harmless: the window is built from its own
 * calendar and only looks dates up in this index.
 */
function indexRecordedKeysByDate(
  logs: readonly HabitActivityLogEntry[],
): Map<string, Set<HabitKey>> {
  const recordedKeysByDate = new Map<string, Set<HabitKey>>();

  for (const entry of logs) {
    if (entry.done !== true || !isHabitKey(entry.habitKey)) {
      continue;
    }

    const recordedKeys = recordedKeysByDate.get(entry.localDate);

    if (recordedKeys === undefined) {
      recordedKeysByDate.set(entry.localDate, new Set([entry.habitKey]));
      continue;
    }

    recordedKeys.add(entry.habitKey);
  }

  return recordedKeysByDate;
}

/** Returns the recorded keys of a date in catalog order, so `recordedKeys` is deterministic. */
function orderRecordedKeys(recordedKeys: Set<HabitKey> | undefined): HabitKey[] {
  if (recordedKeys === undefined) {
    return [];
  }

  return HABIT_KEYS.filter((habitKey) => recordedKeys.has(habitKey));
}

/** Zeroes one `activeDays` counter per honest catalog habit, in catalog order. */
function createPerHabitCounts(): Record<HabitKey, { activeDays: number }> {
  // Accumulator seed in the repo's existing style (lib/auth/session.ts): the catalog is
  // exhaustive, so the loop fills every key of the record without duplicating the catalog.
  const perHabit = {} as Record<HabitKey, { activeDays: number }>;

  for (const habitKey of HABIT_KEYS) {
    perHabit[habitKey] = { activeDays: 0 };
  }

  return perHabit;
}

/** Builds one entry per calendar day of the window, ascending, inert after the reference day. */
function listWindowDays(
  bounds: HabitActivityWindowBounds,
  today: string,
  recordedKeysByDate: Map<string, Set<HabitKey>>,
): HabitActivityDay[] {
  const days: HabitActivityDay[] = [];
  let localDate = bounds.windowStart;

  while (localDate <= bounds.windowEnd) {
    const isFuture = localDate > today;
    const recordedKeys = isFuture ? [] : orderRecordedKeys(recordedKeysByDate.get(localDate));

    days.push({
      localDate,
      weekdayIndex: localDateWeekdayIndex(localDate),
      isToday: localDate === today,
      isFuture,
      recordedKeys,
      isRecorded: recordedKeys.length > 0,
    });

    localDate = addLocalDateDays(localDate, 1);
  }

  return days;
}

/**
 * Computes observed habit activity for one Córdoba window, purely and deterministically.
 *
 * Truthful by construction: `days`, `perHabit`, and `activeDays` always describe the whole
 * window — nothing is zero-filled, truncated, or withheld. `activeDays` counts distinct
 * calendar days, so four habits recorded on one day are one active day. Future days are
 * excluded from `elapsedDays` and rendered inert. `insightStatus` only signals whether the
 * window carries enough elapsed days and at least one active day to be worth interpreting
 * (brief §7.3 rule 5); it is never an adherence verdict.
 *
 * @param input - Window period, the clock-resolved Córdoba reference day, and the stored logs.
 * @returns The habit-activity window, days ordered ascending, one entry per calendar day.
 * @throws {Error} When `input.period` is unsupported or `input.today` is not a valid Córdoba date.
 * @example
 * computeHabitActivity({ period: 'week', today: '2026-09-24', logs }).activeDays;
 */
export function computeHabitActivity(input: HabitActivityInput): HabitActivityWindow {
  const bounds = resolveHabitActivityWindow(input.period, input.today);
  const recordedKeysByDate = indexRecordedKeysByDate(input.logs);
  const days = listWindowDays(bounds, input.today, recordedKeysByDate);
  const perHabit = createPerHabitCounts();

  let elapsedDays = 0;
  let activeDays = 0;

  for (const day of days) {
    if (!day.isFuture) {
      elapsedDays += 1;
    }

    if (!day.isRecorded) {
      continue;
    }

    activeDays += 1;

    for (const habitKey of day.recordedKeys) {
      perHabit[habitKey].activeDays += 1;
    }
  }

  return {
    period: input.period,
    windowStart: bounds.windowStart,
    windowEnd: bounds.windowEnd,
    elapsedDays,
    activeDays,
    perHabit,
    days,
    insightStatus:
      elapsedDays < INSIGHT_MINIMUM_ELAPSED_DAYS || activeDays === 0 ? 'insufficient' : 'available',
    insightMinimumElapsedDays: INSIGHT_MINIMUM_ELAPSED_DAYS,
  };
}

/**
 * Loads and summarizes habit activity of one user for the current Córdoba period.
 *
 * Thin orchestration only: resolve the window from the injected clock, read it with the
 * single bounded loader, and delegate every count to the pure core. All domain rules live
 * in `computeHabitActivity`, so this function adds no interpretation of its own.
 *
 * @param userId - Authenticated owner of the habit logs.
 * @param period - Window to summarize: current week, last 30 days, or last 90 days.
 * @param now - Reference instant; injectable so callers and tests stay deterministic.
 * @returns The habit-activity window of the user for that period.
 * @throws {Error} When `period` is unsupported.
 * @example
 * const activity = await getHabitActivityForUser(1, 'week');
 */
export async function getHabitActivityForUser(
  userId: number,
  period: HabitActivityPeriod,
  now: Date = new Date(),
): Promise<HabitActivityWindow> {
  const today = cordobaLocalDate(now);
  const bounds = resolveHabitActivityWindow(period, today);
  const logs = await loadHabitActivityInWindow(userId, bounds.windowStart, bounds.windowEnd);

  return computeHabitActivity({ period, today, logs });
}
