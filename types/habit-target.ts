import type { HabitKey } from '@/types/habit';

/**
 * Weekday selected by a habit-target schedule, Sunday-first
 * (`0 = Sunday … 6 = Saturday`), matching training-plan scheduling semantics.
 *
 * This is intentionally a different atlas from the Monday-first
 * `localDateWeekdayIndex` helper in `lib/time/cordoba.ts`: habit-target matching
 * must use `sundayFirstLocalDateWeekdayIndex` (v0.10 brief §7 / §9).
 */
export type HabitTargetWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Canonical Sunday-first weekday values of the closed catalog, ascending. */
export const HABIT_TARGET_WEEKDAY_VALUES = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * Type guard narrowing an unknown value to a Sunday-first habit-target weekday.
 *
 * @param value - Candidate value from an untrusted boundary (storage, API, test).
 * @returns True when the value is an integer in `0..6`.
 * @example
 * if (isHabitTargetWeekday(raw)) { matchWeekday(raw); }
 */
export function isHabitTargetWeekday(value: unknown): value is HabitTargetWeekday {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (HABIT_TARGET_WEEKDAY_VALUES as readonly number[]).includes(value)
  );
}

/**
 * One immutable version of a habit's weekly target schedule.
 *
 * A version declares which weekdays the user expects to record a catalog habit,
 * for the inclusive Córdoba date interval `[effectiveFrom, effectiveTo]`.
 * `effectiveTo === null` means open-ended (currently active). Versions of the
 * same habit must never overlap; the pure validator enforces the invariant, and
 * each date is always interpreted by whichever version was effective on it.
 *
 * The closed habit catalog is `HABIT_KEYS`; no custom habit definitions exist.
 */
export interface HabitTargetScheduleVersion {
  /** Catalog habit this version applies to. */
  habitKey: HabitKey;
  /** Inclusive Córdoba start date (YYYY-MM-DD). */
  effectiveFrom: string;
  /** Inclusive Córdoba end date (YYYY-MM-DD), or `null` while open-ended. */
  effectiveTo: string | null;
  /** Monotonic integer version of this schedule, starting at 1. */
  version: number;
  /** Selected weekdays (1–7 distinct Sunday-first values) of this version. */
  weekdays: readonly HabitTargetWeekday[];
}

/**
 * Daily state of one habit on one Córdoba date.
 *
 * - `future_expected`: scheduled but after today; never in the denominator.
 * - `expected_completed`: scheduled, elapsed, with a `done === true` log.
 * - `expected_unrecorded`: scheduled, elapsed, with no `done === true` log.
 * - `extra_recorded`: not scheduled, elapsed, but recorded `done === true`.
 * - `not_expected`: not scheduled and not completed.
 */
export type HabitTargetDayState =
  | 'future_expected'
  | 'expected_completed'
  | 'expected_unrecorded'
  | 'extra_recorded'
  | 'not_expected';

/**
 * Global configuration state: how many of the four fixed catalog habits have a
 * target version effective today. Independent of `HabitTargetMetricState`.
 */
export type HabitTargetConfigurationState =
  | 'not_configured'
  | 'partially_configured'
  | 'configured';

/**
 * Per-habit configuration state. `partially_configured` is only meaningful for
 * the global catalog, so a single habit can only be configured or not.
 */
export type HabitTargetHabitConfigurationState = 'not_configured' | 'configured';
