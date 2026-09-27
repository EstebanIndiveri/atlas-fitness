import type { HabitKey } from '@/types/habit';

/**
 * Minimum elapsed days before a habit-activity window is worth summarizing (brief §7.3 rule 5).
 *
 * This is an insight/presentation policy, not a definition of habit activity and not an
 * adherence threshold: no stored row, count, or historical value depends on it.
 */
export const INSIGHT_MINIMUM_ELAPSED_DAYS = 7;

/**
 * Córdoba calendar window a habit-activity summary can cover: the current Monday-first
 * week, the last 30 days, or the last 90 days. Same literal union as brief §7.2 and as
 * `ProgressPeriod`, so the sibling cards share one window vocabulary.
 */
export type HabitActivityPeriod = 'week' | 'month' | 'quarter';

/** One calendar day of a habit-activity window. */
export interface HabitActivityDay {
  /** Córdoba calendar date (YYYY-MM-DD). */
  localDate: string;
  /** Monday-first weekday index, 0 (Monday) … 6 (Sunday). */
  weekdayIndex: number;
  isToday: boolean;
  /** Future days are inert: never counted as elapsed and never rendered as missed. */
  isFuture: boolean;
  /** Catalog habits with `done === true` on this date, in catalog order. */
  recordedKeys: HabitKey[];
  /** `recordedKeys.length > 0`. */
  isRecorded: boolean;
}

/**
 * Observed habit activity for one Córdoba period.
 *
 * The window is always truthful: every count covers the whole window, nothing is
 * zero-filled and nothing is truncated. No composite, target, score, or target-adherence
 * claim is computed here (brief §7.3 rule 6).
 */
export interface HabitActivityWindow {
  period: HabitActivityPeriod;
  /** Inclusive Córdoba start date (YYYY-MM-DD). */
  windowStart: string;
  /** Inclusive Córdoba end date (YYYY-MM-DD). */
  windowEnd: string;
  /** Days of the window that are not future. */
  elapsedDays: number;
  /** Days of the window with `isRecorded === true`. */
  activeDays: number;
  perHabit: Record<HabitKey, { activeDays: number }>;
  /** Ordered ascending, one entry per calendar day of the window. */
  days: HabitActivityDay[];
  /** Advisory presentation policy (see `INSIGHT_MINIMUM_ELAPSED_DAYS`), not a domain verdict. */
  insightStatus: 'available' | 'insufficient';
  /** Echoed so a consumer can explain the threshold without importing the constant. */
  insightMinimumElapsedDays: number;
}

/**
 * Minimal stored-log shape the pure core reads.
 *
 * `habitKey` stays a plain string because it arrives from storage; the core narrows it to
 * the honest catalog and treats `done === true` as the only recording signal — an `amount`
 * alone never marks a day recorded (brief §7.3 rule 1).
 */
export interface HabitActivityLogEntry {
  localDate: string;
  habitKey: string;
  done: boolean;
}

/** Pure inputs of `computeHabitActivity`: the caller supplies the clock-resolved day. */
export interface HabitActivityInput {
  period: HabitActivityPeriod;
  /** Córdoba calendar date (YYYY-MM-DD) of the reference instant; the core has no clock. */
  today: string;
  logs: readonly HabitActivityLogEntry[];
}
