/**
 * GET /api/stats/week — authenticated weekly consistency snapshot.
 *
 * Consistency reuses the streak active-day rule (an ended workout OR a daily
 * check-in on a Córdoba local date), so the Week card stays coherent with the
 * StreakChip. Every value is `atlas_computed`: derived deterministically from the
 * user's own stored data, never fabricated (DATA HONESTY RULE).
 */

/** One day of the current Córdoba week (Monday-first). Dates are YYYY-MM-DD. */
export interface WeekDayConsistency {
  /** Córdoba calendar date for the day (YYYY-MM-DD). */
  date: string;
  /** Monday-first weekday index (0 = Monday … 6 = Sunday). */
  weekdayIndex: number;
  /** Whether the day is an active day (ended workout OR daily check-in). */
  active: boolean;
  /** Whether the day is the current Córdoba day. */
  isToday: boolean;
  /** Whether the day is still in the future relative to today. */
  isFuture: boolean;
}

/** Consistency for the current Córdoba week (always 7 days, Monday → Sunday). */
export interface WeekConsistency {
  /** Monday of the week (YYYY-MM-DD). */
  weekStart: string;
  /** Sunday of the week (YYYY-MM-DD). */
  weekEnd: string;
  /** Count of active days elapsed so far this week. */
  activeCount: number;
  /** Seven days ordered Monday → Sunday. */
  days: WeekDayConsistency[];
}
