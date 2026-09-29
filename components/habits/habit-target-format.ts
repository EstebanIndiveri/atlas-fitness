import { HABIT_TARGET_COPY } from '@/lib/copy/habit-targets';
import { HABIT_TARGET_WEEKDAY_VALUES } from '@/types/habit-target';
import type { HabitTargetWeekday } from '@/types/habit-target';

/**
 * Monday-to-Sunday display order for the accessible weekday selector.
 *
 * The domain values remain Sunday-first (`0 = Sunday … 6 = Saturday`), matching
 * the client contract and the canonical Córdoba weekday helper; only the order
 * shown to the reader starts on Monday.
 */
export const WEEKDAY_DISPLAY_ORDER: readonly HabitTargetWeekday[] = [
  1, 2, 3, 4, 5, 6, 0,
];

/**
 * Deduplicates and sorts weekdays into the canonical Sunday-first domain order.
 *
 * @param values - Weekday values in any order, possibly with duplicates.
 * @returns Distinct weekdays ascending by domain value.
 * @example sortWeekdays([3, 0, 3]) // [0, 3]
 */
export function sortWeekdays(values: readonly HabitTargetWeekday[]): HabitTargetWeekday[] {
  const present = new Set(values);
  return HABIT_TARGET_WEEKDAY_VALUES.filter((weekday) => present.has(weekday));
}

/**
 * Toggles one weekday and returns the selection in canonical Sunday-first order.
 *
 * @param selected - Current selection.
 * @param weekday - Weekday to add or remove.
 * @returns The next selection, always sorted ascending by domain value.
 * @example toggleWeekday([0], 1) // [0, 1]
 */
export function toggleWeekday(
  selected: readonly HabitTargetWeekday[],
  weekday: HabitTargetWeekday,
): HabitTargetWeekday[] {
  return selected.includes(weekday)
    ? sortWeekdays(selected.filter((value) => value !== weekday))
    : sortWeekdays([...selected, weekday]);
}

/**
 * Human list of selected weekdays for the vigencia summary.
 *
 * @param values - Selected weekdays.
 * @returns Es-AR weekday names in domain order, or an empty string when none.
 * @example formatWeekdayList([3, 1]) // "Lunes, Miércoles"
 */
export function formatWeekdayList(values: readonly HabitTargetWeekday[]): string {
  return sortWeekdays(values)
    .map((weekday) => HABIT_TARGET_COPY.weekdays[weekday])
    .join(', ');
}
