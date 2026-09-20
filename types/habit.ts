/**
 * Shared catalog of manually tracked daily habits (FE + BE single source of truth).
 *
 * Every habit is recorded as a manual completion toggle, so each value is
 * inherently `source: user_input`; Atlas never fabricates targets, counts, or
 * progress ratios for these (DATA HONESTY RULE).
 */
export const HABIT_KEYS = ['hydration', 'walk', 'mobility', 'sleep'] as const;

export type HabitKey = (typeof HABIT_KEYS)[number];

/**
 * Type guard narrowing an unknown value to a known habit key.
 *
 * @param value - Candidate value from an untrusted boundary (API, storage).
 * @returns True when the value is one of the honest catalog keys.
 * @example
 * if (isHabitKey(raw)) { useHabit(raw); }
 */
export function isHabitKey(value: unknown): value is HabitKey {
  return typeof value === 'string' && (HABIT_KEYS as readonly string[]).includes(value);
}
