import { cordobaLocalDate, addLocalDateDays, localDateWeekdayIndex } from '@/lib/time/cordoba';
import { loadActiveDates } from '@/lib/services/streaks';
import type { WeekConsistency, WeekDayConsistency } from '@/types/week';

const DAYS_IN_WEEK = 7;

/**
 * Builds the current Córdoba week (Monday-first) consistency from a set of active
 * dates. Pure and deterministic: a day is `active` only when it is not in the
 * future and its date is present in `activeDates` (DATA HONESTY RULE).
 *
 * @param today Córdoba calendar date for "now" (YYYY-MM-DD).
 * @param activeDates Set of active Córdoba dates (ended workout OR daily check-in).
 * @returns Weekly consistency with seven ordered days and the elapsed active count.
 * @throws {Error} When `today` is not a valid YYYY-MM-DD date.
 * @example computeWeekConsistency('2026-09-24', new Set(['2026-09-24'])).activeCount // 1
 */
export function computeWeekConsistency(
  today: string,
  activeDates: Set<string>
): WeekConsistency {
  const todayIndex = localDateWeekdayIndex(today);
  const weekStart = addLocalDateDays(today, -todayIndex);
  const weekEnd = addLocalDateDays(weekStart, DAYS_IN_WEEK - 1);

  const days: WeekDayConsistency[] = [];
  let activeCount = 0;
  for (let weekdayIndex = 0; weekdayIndex < DAYS_IN_WEEK; weekdayIndex += 1) {
    const date = addLocalDateDays(weekStart, weekdayIndex);
    const isToday = date === today;
    const isFuture = date > today;
    const active = !isFuture && activeDates.has(date);
    if (active) {
      activeCount += 1;
    }
    days.push({ date, weekdayIndex, active, isToday, isFuture });
  }

  return { weekStart, weekEnd, activeCount, days };
}

/**
 * Weekly consistency for a user's current Córdoba week. Reuses the streak
 * active-day rule (ended workout OR daily check-in) so the Week card stays
 * coherent with the streak; every value is `atlas_computed`.
 *
 * @param userId Owner of the activity to aggregate.
 * @param now Clock instant (defaults to now) resolving "today" in Córdoba.
 * @returns The current week's consistency for the user.
 * @example await getWeekConsistencyForUser(1)
 */
export async function getWeekConsistencyForUser(
  userId: number,
  now: Date = new Date()
): Promise<WeekConsistency> {
  const today = cordobaLocalDate(now);
  const activeDates = await loadActiveDates(userId);
  return computeWeekConsistency(today, activeDates);
}
