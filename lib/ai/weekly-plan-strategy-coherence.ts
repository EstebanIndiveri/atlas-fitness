import {
  isRecoveryGroup,
  matchesMuscleGroup,
  normalizeFocusLabel,
  requiredFocusCoverage,
  resolveFocusAreas,
} from './weekly-plan-focus';
import type { WeeklyPlanStrategyDay, WeeklyPlanStrategyInput } from './weekly-plan-week-types';

/**
 * Checks that a training day declares areas that resolve against the visible catalog.
 *
 * @param day Strategy day labelled with a training focus.
 * @param input Weekly brief with the visible catalog.
 * @returns True when every declared area is visible in the catalog and named by the day label.
 */
export function hasDeclaredFocus(day: WeeklyPlanStrategyDay, input: WeeklyPlanStrategyInput): boolean {
  if (day.focusAreas.length === 0) return false;
  const label = normalizeFocusLabel(day.focus);
  return day.focusAreas.every(
    (area) =>
      resolveFocusAreas(area, input.catalog).length > 0 &&
      label.includes(normalizeFocusLabel(area)),
  );
}

/**
 * Checks that a recovery day is bound to a genuine recovery group of the visible catalog.
 *
 * @param day Strategy day labelled as recovery.
 * @param input Weekly brief with the visible catalog.
 * @returns True when the day declares a recovery area the catalog actually exposes.
 */
export function isBoundRecoveryDay(
  day: WeeklyPlanStrategyDay,
  input: WeeklyPlanStrategyInput,
): boolean {
  return day.focusAreas.some(
    (area) => isRecoveryGroup(area) && resolveFocusAreas(area, input.catalog).length > 0,
  );
}

/**
 * Checks that the training days of the week cover the required focus labels the engine can schedule.
 *
 * The Routine Engine V2 schedules at most six focus areas per session, so a week only has to cover
 * the required labels up to that capacity (see `requiredFocusCoverage`). Labels beyond it are
 * reported as a capacity note instead of making an otherwise valid week incoherent.
 *
 * @param trainingDays Strategy days that carry training work.
 * @param input Weekly brief with the goal, the requested focus areas and the visible catalog.
 * @returns True when every required label inside the engine capacity is matched by a declared area.
 */
export function coversRequiredFocus(
  trainingDays: readonly WeeklyPlanStrategyDay[],
  input: WeeklyPlanStrategyInput,
): boolean {
  const coverage = requiredFocusCoverage(input);
  const mandatory = coverage.labels.slice(0, coverage.coverageThreshold);
  if (mandatory.length === 0) return true;
  const areas = trainingDays.flatMap((day) => day.focusAreas);
  return mandatory.every((label) => areas.some((area) => matchesMuscleGroup(area, label)));
}

/**
 * Checks that at least one rest day separates the sessions scheduled in the week.
 *
 * @param weekdays Weekdays already scheduled with a session.
 * @returns True when two sessions are separated by an unscheduled weekday.
 */
export function hasRestBetweenSessions(weekdays: readonly number[]): boolean {
  const sorted = [...weekdays].sort((left, right) => left - right);
  return sorted.some((weekday, index) => index > 0 && weekday - (sorted[index - 1] ?? weekday) > 1);
}
