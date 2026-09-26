import { AppError } from '@/types/errors';

import {
  isRecoveryFocus,
  listCatalogMuscleGroups,
  matchesMuscleGroup,
  recoveryFocusAreas,
  requiredFocusLabels,
  weeklyFocusLabels,
} from './weekly-plan-focus';
import { requestGeminiWeeklyFocusDays } from './weekly-plan-strategy-gemini';
import {
  WEEKLY_PLAN_WEEKDAYS,
  type WeeklyPlanStrategy,
  type WeeklyPlanStrategyDay,
  type WeeklyPlanStrategyDependencies,
  type WeeklyPlanStrategyInput,
  type WeeklyPlanWeekday,
} from './weekly-plan-week-types';

const RECOVERY_DAY_FOCUS = 'Movilidad y recuperación';
/** Five and six day weeks keep the Monday to Friday contract, so only shorter weeks spread. */
const MAX_SPREAD_DAYS_PER_WEEK = 4;

/** Training weekdays used when no coherent Gemini distribution is available. */
const WEEKDAY_PATTERNS: Record<number, readonly WeeklyPlanWeekday[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [0, 2, 4, 6],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
};

function weekdayPatternFor(daysPerWeek: number): readonly WeeklyPlanWeekday[] {
  const pattern = WEEKDAY_PATTERNS[daysPerWeek];
  if (!pattern) {
    throw new AppError('VALIDATION', 'La cantidad de días de entrenamiento debe estar entre 1 y 6.');
  }
  return pattern;
}

/** Rotates the requested focus labels over the training days of the week. */
function buildTrainingDay(
  dayOfWeek: WeeklyPlanWeekday,
  ordinal: number,
  focus: string,
): WeeklyPlanStrategyDay {
  return {
    dayOfWeek,
    title: `Día ${ordinal} · ${focus}`,
    focus,
    focusAreas: [focus],
  };
}

function buildRecoveryDay(
  dayOfWeek: WeeklyPlanWeekday,
  ordinal: number,
  focusAreas: readonly string[],
): WeeklyPlanStrategyDay {
  return {
    dayOfWeek,
    title: `Día ${ordinal} · ${RECOVERY_DAY_FOCUS}`,
    focus: RECOVERY_DAY_FOCUS,
    focusAreas,
  };
}

/**
 * Distributes the week with the deterministic goal and focus aware strategy.
 *
 * The pattern spreads sessions instead of stacking them, turns the isolated rest day of a
 * six day week into an explicit recovery session and rotates the requested focus labels so
 * every training day has a specific focus without repeating a single hardcoded split.
 *
 * @param input Weekly brief with goal, training days, focus areas and the visible catalog.
 * @returns The deterministic weekly strategy, always coherent for the given brief.
 * @throws {AppError} When the visible catalog has no muscle group to distribute.
 * @example
 * buildDeterministicWeeklyStrategy(brief).days.map((day) => day.focus);
 */
export function buildDeterministicWeeklyStrategy(
  input: WeeklyPlanStrategyInput,
): WeeklyPlanStrategy {
  const weekdays = weekdayPatternFor(input.daysPerWeek);
  const restDays = WEEKLY_PLAN_WEEKDAYS.filter((weekday) => !weekdays.includes(weekday));
  const recoveryWeekday = restDays.length <= 1 ? (weekdays[weekdays.length - 1] ?? null) : null;
  const labels = weeklyFocusLabels(input);
  if (labels.length === 0) {
    throw new AppError(
      'VALIDATION',
      'No hay ejercicios disponibles para distribuir el foco de la semana.',
    );
  }
  const recoveryAreas = recoveryWeekday === null ? [] : recoveryFocusAreas(input);

  let trainingIndex = 0;
  const days = weekdays.map((dayOfWeek, index) => {
    if (dayOfWeek === recoveryWeekday) return buildRecoveryDay(dayOfWeek, index + 1, recoveryAreas);
    const focus = labels[trainingIndex % labels.length] ?? labels[0];
    trainingIndex += 1;
    return buildTrainingDay(dayOfWeek, index + 1, focus);
  });

  return { source: 'fallback', days, restDays };
}

function stacksConsecutiveDays(weekdays: readonly WeeklyPlanWeekday[]): boolean {
  const sorted = [...weekdays].sort((left, right) => left - right);
  return sorted.some(
    (weekday, index) => index > 0 && weekday - (sorted[index - 1] ?? weekday) === 1,
  );
}

function coversRequiredFocus(
  trainingDays: readonly WeeklyPlanStrategyDay[],
  input: WeeklyPlanStrategyInput,
): boolean {
  return requiredFocusLabels(input).every((label) =>
    trainingDays.some((day) => matchesMuscleGroup(day.focus, label)),
  );
}

/**
 * Requests a weekly strategy from Gemini.
 *
 * @param input Weekly brief with goal, training days, focus areas and the visible catalog.
 * @param deps Optional fetch implementation, environment and timeout overrides.
 * @returns The coherent Gemini strategy, or null when the key is missing, the request fails
 * or Gemini answers an incoherent distribution.
 * @example
 * await requestGeminiWeeklyStrategy(brief, { env: { GEMINI_API_KEY: '' } }); // null
 */
export async function requestGeminiWeeklyStrategy(
  input: WeeklyPlanStrategyInput,
  deps: WeeklyPlanStrategyDependencies = {},
): Promise<WeeklyPlanStrategy | null> {
  const focusDays = await requestGeminiWeeklyFocusDays(input, weeklyFocusLabels(input), deps);
  if (!focusDays) return null;

  const scheduled = new Set(focusDays.map((entry) => entry.dayOfWeek));
  const recoveryAreas = recoveryFocusAreas(input);
  const strategy: WeeklyPlanStrategy = {
    source: 'gemini',
    days: focusDays.map((entry, index) =>
      isRecoveryFocus(entry.focus)
        ? buildRecoveryDay(entry.dayOfWeek, index + 1, recoveryAreas)
        : buildTrainingDay(entry.dayOfWeek, index + 1, entry.focus),
    ),
    restDays: WEEKLY_PLAN_WEEKDAYS.filter((weekday) => !scheduled.has(weekday)),
  };
  return isCoherentWeeklyStrategy(strategy, input) ? strategy : null;
}

/**
 * Resolves the weekly strategy, preferring coherent Gemini output over the deterministic one.
 *
 * @param input Weekly brief with goal, training days, focus areas and the visible catalog.
 * @param deps Optional fetch implementation, environment and timeout overrides.
 * @returns The coherent Gemini strategy when available, otherwise the deterministic distribution.
 * @example
 * (await resolveWeeklyStrategy(brief)).source; // 'gemini' | 'fallback'
 */
export async function resolveWeeklyStrategy(
  input: WeeklyPlanStrategyInput,
  deps: WeeklyPlanStrategyDependencies = {},
): Promise<WeeklyPlanStrategy> {
  const geminiStrategy = await requestGeminiWeeklyStrategy(input, deps);
  if (geminiStrategy) return geminiStrategy;
  return buildDeterministicWeeklyStrategy(input);
}

/**
 * Checks whether a weekly strategy is coherent enough to be used as the week proposal.
 *
 * @param strategy Strategy produced by Gemini or by the deterministic distribution.
 * @param input Weekly brief the strategy must satisfy.
 * @returns True when the week has the requested days, unique weekdays, resolvable focus,
 * coverage of the requested focus and a reasonable recovery distribution.
 * @example
 * isCoherentWeeklyStrategy(strategy, brief); // false when a training day repeats
 */
export function isCoherentWeeklyStrategy(
  strategy: WeeklyPlanStrategy,
  input: WeeklyPlanStrategyInput,
): boolean {
  const days = strategy.days;
  if (days.length !== input.daysPerWeek) return false;
  const weekdays = days.map((day) => day.dayOfWeek);
  if (new Set(weekdays).size !== weekdays.length) return false;
  if (!weekdays.every((weekday) => WEEKLY_PLAN_WEEKDAYS.includes(weekday))) return false;
  if (!days.every((day) => day.title.trim().length > 0 && day.focus.trim().length > 0)) return false;

  const groups = listCatalogMuscleGroups(input.catalog);
  const trainingDays = days.filter((day) => !isRecoveryFocus(day.focus));
  if (trainingDays.length === 0) return false;
  if (
    !trainingDays.every((day) => groups.some((group) => matchesMuscleGroup(day.focus, group)))
  ) {
    return false;
  }
  if (!coversRequiredFocus(trainingDays, input)) return false;
  if (
    input.daysPerWeek <= MAX_SPREAD_DAYS_PER_WEEK &&
    stacksConsecutiveDays(trainingDays.map((day) => day.dayOfWeek))
  ) {
    return false;
  }
  return true;
}
