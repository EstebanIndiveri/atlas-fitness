import type { HabitKey } from '@/types/habit';
import type {
  HabitTargetConfigurationState,
  HabitTargetDayState,
  HabitTargetHabitConfigurationState,
  HabitTargetScheduleVersion,
  HabitTargetWeekday,
} from '@/types/habit-target';

/**
 * Córdoba calendar window a target-adherence summary covers: the current
 * Monday-first week, the last 30 days, or the last 90 days.
 *
 * Deliberately a separate literal union from `HabitActivityPeriod` even though
 * the values match: target adherence is a different contract from observed
 * activity and must not be conflated with it (v0.10 brief §7 / §10).
 */
export type HabitTargetAdherencePeriod = 'week' | 'month' | 'quarter';

/**
 * Metric state of a target-adherence window or habit.
 *
 * - `no_expected_days`: the denominator is exactly zero; no ratio is emitted.
 * - `result`: the denominator is greater than zero; counts (and a per-cent when
 *   applicable) are emitted.
 */
export type HabitTargetMetricState = 'no_expected_days' | 'result';

/**
 * One expected habit-day: a catalog habit the user scheduled for one Córdoba
 * date. This is the unit of the adherence denominator (v0.10 brief §7).
 */
export interface ExpectedHabitDay {
  /** Córdoba date the habit was expected on (YYYY-MM-DD). */
  localDate: string;
  /** Catalog habit expected that day. */
  habitKey: HabitKey;
  /** Sunday-first weekday of `localDate` (0 = Sunday … 6 = Saturday). */
  weekday: HabitTargetWeekday;
}

/** One calendar day of a target-adherence window, with per-habit daily states. */
export interface HabitTargetDay {
  /** Córdoba date (YYYY-MM-DD). */
  localDate: string;
  /** Sunday-first weekday of `localDate`. */
  weekday: HabitTargetWeekday;
  isToday: boolean;
  /** Future days never enter the denominator and are rendered inert. */
  isFuture: boolean;
  /** Daily state of every catalog habit, in catalog order. */
  habitStates: Record<HabitKey, HabitTargetDayState>;
}

/** Honest target-adherence result for one habit of a window. */
export interface HabitTargetHabitAdherence {
  /** Whether the habit has a target version effective today (historical history aside). */
  configurationState: HabitTargetHabitConfigurationState;
  /** Whether this habit has a positive expected-habit-day denominator. */
  metricState: HabitTargetMetricState;
  /** Expected elapsed habit-days for this habit in the window. */
  expectedHabitDays: number;
  /** Expected elapsed habit-days with `done === true`. */
  completedExpectedHabitDays: number;
  /** `done === true` records on non-expected elapsed days for this habit. */
  extraRecordedHabitDays: number;
  /** `round(100 * completed / expected)` only when `expected > 0`; otherwise `null`. */
  adherencePercent: number | null;
}

/**
 * Honest target adherence for one Córdoba period.
 *
 * `configurationState` (current intent) and `metricState` (window denominator)
 * are independent: an ended schedule yields `not_configured` while its elapsed
 * expected days still produce a historical result. `N de M` is always derivable
 * from the counts; the percentage is secondary and only present for a result.
 */
export interface HabitTargetAdherenceWindow {
  period: HabitTargetAdherencePeriod;
  /** Inclusive Córdoba start date (YYYY-MM-DD). */
  windowStart: string;
  /** Inclusive Córdoba end date (YYYY-MM-DD). */
  windowEnd: string;
  /** Córdoba reference day; future days are excluded from the denominator. */
  today: string;
  /** Global current-intent state across the fixed catalog. */
  configurationState: HabitTargetConfigurationState;
  /** Global denominator state of the window. */
  metricState: HabitTargetMetricState;
  /** Expected elapsed habit-days across all habits. */
  expectedHabitDays: number;
  /** Expected elapsed habit-days completed across all habits. */
  completedExpectedHabitDays: number;
  /** Extra recorded habit-days across all habits. */
  extraRecordedHabitDays: number;
  /** `round(100 * completed / expected)` only when `expected > 0`; otherwise `null`. */
  adherencePercent: number | null;
  /** Per-habit results in catalog order. */
  perHabit: Record<HabitKey, HabitTargetHabitAdherence>;
  /** Ordered ascending, one entry per calendar day of the window. */
  days: HabitTargetDay[];
}

/**
 * Minimal stored-log shape the pure core reads.
 *
 * `habitKey` stays a plain string because it arrives from storage; the core
 * narrows it to the honest catalog and treats `done === true` as the only
 * completion signal. There is no target quantity in v0.10: no `amount` field is
 * read and amounts never affect adherence (v0.10 brief §6 / §7).
 */
export interface HabitTargetLogEntry {
  localDate: string;
  habitKey: string;
  done: boolean;
}

/** Pure inputs of `computeHabitTargetAdherence`; the caller supplies the clock-resolved day. */
export interface HabitTargetAdherenceInput {
  period: HabitTargetAdherencePeriod;
  /** Córdoba calendar date (YYYY-MM-DD) of the reference instant; the core has no clock. */
  today: string;
  schedules: readonly HabitTargetScheduleVersion[];
  logs: readonly HabitTargetLogEntry[];
}

/** Pure inputs of `resolveExpectedHabitDays`: an inclusive Córdoba date interval. */
export interface ResolveExpectedHabitDaysInput {
  schedules: readonly HabitTargetScheduleVersion[];
  /** Inclusive Córdoba start date (YYYY-MM-DD). */
  start: string;
  /** Inclusive Córdoba end date (YYYY-MM-DD). */
  end: string;
}
