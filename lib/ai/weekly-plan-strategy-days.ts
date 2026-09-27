import { MAX_ENGINE_FOCUS_AREAS } from './weekly-plan-focus-vocabulary';
import type { WeeklyPlanStrategyDay, WeeklyPlanWeekday } from './weekly-plan-week-types';

export const RECOVERY_DAY_FOCUS = 'Movilidad y recuperación';
/** The Routine Engine V2 accepts at most six focus areas per session. */
const MAX_LABELS_PER_DAY = MAX_ENGINE_FOCUS_AREAS;

/** Joins the focus labels of a day the way the product copy reads them: `A`, `A y B`, `A, B y C`. */
export function joinFocusLabels(labels: readonly string[]): string {
  const first = labels[0];
  if (first === undefined) return '';
  const last = labels[labels.length - 1] ?? first;
  if (labels.length === 1) return first;
  if (labels.length === 2) return `${first} y ${last}`;
  return `${labels.slice(0, -1).join(', ')} y ${last}`;
}

/**
 * Splits the week focus labels over the training days, consuming every requested label.
 *
 * Short weeks group several labels per day instead of dropping the ones they cannot fit, and a
 * week with more days than labels keeps cycling them so no day is left without a focus.
 *
 * @param labels Focus labels the week must distribute.
 * @param trainingDayCount Training days available in the week.
 * @returns One label group per training day, never empty and never longer than the engine bound.
 * @example
 * splitFocusLabels(['Piernas', 'Pecho', 'Core'], 2); // [['Piernas', 'Pecho'], ['Core']]
 */
export function splitFocusLabels(labels: readonly string[], trainingDayCount: number): string[][] {
  const perDay = Math.max(
    1,
    Math.min(MAX_LABELS_PER_DAY, Math.ceil(labels.length / Math.max(1, trainingDayCount))),
  );
  const groups: string[][] = [];
  for (let index = 0; index < trainingDayCount; index += 1) {
    const group = labels.slice(index * perDay, (index + 1) * perDay);
    const cycled = labels[(index * perDay) % labels.length] ?? labels[0] ?? '';
    groups.push(group.length > 0 ? group : [cycled]);
  }
  return groups;
}

/** Builds a training day that declares exactly the focus areas it was given. */
export function buildTrainingDay(
  dayOfWeek: WeeklyPlanWeekday,
  ordinal: number,
  focusAreas: readonly string[],
): WeeklyPlanStrategyDay {
  const focus = joinFocusLabels(focusAreas);
  return {
    dayOfWeek,
    title: `Día ${ordinal} · ${focus}`,
    focus,
    focusAreas: [...focusAreas],
  };
}

/** Builds a recovery day bound only to the recovery areas of the visible catalog. */
export function buildRecoveryDay(
  dayOfWeek: WeeklyPlanWeekday,
  ordinal: number,
  focusAreas: readonly string[],
): WeeklyPlanStrategyDay {
  return {
    dayOfWeek,
    title: `Día ${ordinal} · ${RECOVERY_DAY_FOCUS}`,
    focus: RECOVERY_DAY_FOCUS,
    focusAreas: [...focusAreas],
  };
}
