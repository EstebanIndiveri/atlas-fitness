import { maxSetsForSession } from './routine-draft-selection';
import {
  isRecoveryFocus,
  isRecoveryGroup,
  listCatalogMuscleGroups,
  matchesMuscleGroup,
  recoveryFocusAreas,
  requiredFocusCoverage,
  resolveFocusAreas,
} from './weekly-plan-focus';
import type {
  WeeklyPlanComposedDay,
  WeeklyPlanValidationFailure,
  WeeklyPlanValidationInput,
  WeeklyPlanValidationProposal,
  WeeklyPlanValidationResult,
} from './weekly-plan-week-types';

/** A repeated exercise is only unreasonable when it carries three or more distinct sessions. */
const MIN_REPEATED_TRAINING_DAYS = 3;

interface WeeklyPlanValidationIssue {
  code: WeeklyPlanValidationFailure;
  reason: string;
}

function declaredFocusAreas(
  day: WeeklyPlanComposedDay,
  input: WeeklyPlanValidationInput,
): string[] {
  return day.focusAreas.filter((area) => resolveFocusAreas(area, input.catalog).length > 0);
}

function hasUnrelatedWork(
  day: WeeklyPlanComposedDay,
  input: WeeklyPlanValidationInput,
  groupCount: number,
  dayCount: number,
): boolean {
  const declared = declaredFocusAreas(day, input);
  if (declared.length === 0) return groupCount > dayCount;
  return day.exercises.some(
    (exercise) => !declared.some((area) => matchesMuscleGroup(area, exercise.muscleGroup)),
  );
}

/**
 * A recovery session only carries work bound to that day, never a whole training session.
 *
 * @param day Composed day scheduled as recovery.
 * @param input Weekly brief with the visible catalog.
 * @returns True when the day carries exercises outside its own recovery focus.
 */
function hasForeignRecoveryWork(
  day: WeeklyPlanComposedDay,
  input: WeeklyPlanValidationInput,
): boolean {
  if (day.exercises.length === 0) return false;
  const declared = declaredFocusAreas(day, input);
  if (declared.length === 0) return false;
  return day.exercises.some(
    (exercise) => !declared.some((area) => matchesMuscleGroup(area, exercise.muscleGroup)),
  );
}

/**
 * A recovery label is only honest when it is bound to a recovery group the catalog exposes.
 *
 * @param day Composed day scheduled as recovery.
 * @param input Weekly brief with the visible catalog.
 * @returns True when the day declares a recovery focus area resolvable against the catalog.
 */
function isGenuineRecoveryDay(
  day: WeeklyPlanComposedDay,
  input: WeeklyPlanValidationInput,
): boolean {
  return day.focusAreas.some(
    (area) => isRecoveryGroup(area) && resolveFocusAreas(area, input.catalog).length > 0,
  );
}

function isRepeatedBeyondFocus(days: readonly WeeklyPlanComposedDay[]): boolean {
  const appearances = new Map<number, { days: Set<number>; focuses: Set<string> }>();
  days.forEach((day, index) => {
    for (const exercise of day.exercises) {
      const entry = appearances.get(exercise.exerciseId) ?? { days: new Set(), focuses: new Set() };
      entry.days.add(index);
      entry.focuses.add(day.focus.toLowerCase());
      appearances.set(exercise.exerciseId, entry);
    }
  });
  return [...appearances.values()].some(
    (entry) =>
      entry.days.size >= MIN_REPEATED_TRAINING_DAYS && entry.focuses.size === entry.days.size,
  );
}

function collectIssues(
  proposal: WeeklyPlanValidationProposal,
  input: WeeklyPlanValidationInput,
): WeeklyPlanValidationIssue[] {
  const issues: WeeklyPlanValidationIssue[] = [];
  const days = proposal.days;
  const groups = listCatalogMuscleGroups(input.catalog);
  const catalogIds = new Set(input.catalog.map((item) => item.id));

  if (days.length !== input.daysPerWeek) {
    issues.push({
      code: 'training-day-count',
      reason: `La semana tiene ${days.length} días y el brief pidió ${input.daysPerWeek}.`,
    });
  }

  const weekdays = days.map((day) => day.dayOfWeek);
  const duplicated = [...new Set(weekdays.filter((weekday, index) => weekdays.indexOf(weekday) !== index))];
  if (duplicated.length > 0) {
    issues.push({
      code: 'duplicate-weekday',
      reason: `La semana repite días de la semana: ${duplicated.join(', ')}.`,
    });
  }

  const unknownIds = [
    ...new Set(
      days
        .flatMap((day) => day.exercises.map((exercise) => exercise.exerciseId))
        .filter((exerciseId) => !catalogIds.has(exerciseId)),
    ),
  ];
  if (unknownIds.length > 0) {
    issues.push({
      code: 'unknown-exercise',
      reason: `Hay ejercicios fuera del catálogo visible: ${unknownIds.join(', ')}.`,
    });
  }

  const trainingDays = days.filter((day) => !isRecoveryFocus(day.focus));
  const recoveryDays = days.filter((day) => isRecoveryFocus(day.focus));
  const genuineRecoveryCount = recoveryDays.filter((day) => isGenuineRecoveryDay(day, input)).length;
  if (proposal.restDays.length === 0 && genuineRecoveryCount === 0) {
    issues.push({
      code: 'missing-recovery',
      reason: 'La semana no deja ningún día de descanso ni de recuperación.',
    });
  } else if (
    proposal.restDays.length <= 1 &&
    genuineRecoveryCount === 0 &&
    // A catalog without recovery work cannot express it, so it is not demanded from the week.
    recoveryFocusAreas(input).length > 0
  ) {
    issues.push({
      code: 'insufficient-recovery',
      reason: 'La semana no intercala descanso ni recuperación entre las sesiones.',
    });
  }

  const covered = (label: string) =>
    trainingDays.some(
      (day) =>
        matchesMuscleGroup(day.focus, label) ||
        day.focusAreas.some((area) => matchesMuscleGroup(area, label)),
    );
  // The Routine Engine V2 schedules at most six focus areas per session, so a week covers at most
  // `6 × daysPerWeek` labels: the labels beyond that capacity are reported as a note, never as a
  // failure, because no week can train them.
  const coverage = requiredFocusCoverage(input);
  const uncovered = coverage.labels
    .slice(0, coverage.coverageThreshold)
    .filter((label) => !covered(label));
  if (uncovered.length > 0) {
    issues.push({
      code: 'focus-coverage',
      reason: `La semana no cubre el foco pedido: ${uncovered.join(', ')}.${
        coverage.uncoveredNote ? ` ${coverage.uncoveredNote}` : ''
      }`,
    });
  }

  const unrelatedDays = trainingDays.filter(
    (day) =>
      day.exercises.length > 0 && hasUnrelatedWork(day, input, groups.length, days.length),
  );
  if (unrelatedDays.length > 0) {
    issues.push({
      code: 'unrelated-focus',
      reason: `Hay ejercicios que no corresponden al foco de estos días: ${unrelatedDays
        .map((day) => day.title)
        .join(', ')}.`,
    });
  }

  const foreignRecoveryDays = recoveryDays.filter(
    (day) => !isGenuineRecoveryDay(day, input) || hasForeignRecoveryWork(day, input),
  );
  if (foreignRecoveryDays.length > 0) {
    issues.push({
      code: 'recovery-focus',
      reason: `La sesión de recuperación no está ligada a un grupo de recuperación visible o incluye ejercicios fuera de su foco: ${foreignRecoveryDays
        .map((day) => day.title)
        .join(', ')}.`,
    });
  }

  if (isRepeatedBeyondFocus(days)) {
    issues.push({
      code: 'repeated-exercise',
      reason: 'La semana repite el mismo ejercicio como eje de tres o más sesiones distintas.',
    });
  }

  const maxSets = maxSetsForSession(input.sessionLengthMinutes);
  const overloadedDays = days.filter(
    (day) => day.exercises.reduce((total, exercise) => total + exercise.targetSets, 0) > maxSets,
  );
  if (overloadedDays.length > 0) {
    issues.push({
      code: 'weekly-volume',
      reason: `El volumen diario supera lo razonable para ${input.sessionLengthMinutes} minutos: ${overloadedDays
        .map((day) => day.title)
        .join(', ')}.`,
    });
  }

  return issues;
}

/**
 * Validates a composed week before it is returned as a proposal.
 *
 * Reports every problem found in one pass so the composer can recompose with the
 * deterministic strategy or fail with an explicit domain error instead of a partial week.
 *
 * @param proposal Composed week with its scheduled days and rest days.
 * @param input Brief the week must satisfy, including the caller-visible catalog.
 * @returns Whether the week is valid, the failure codes and their explanations.
 * @example
 * validateWeeklyProposal(week, brief).failures; // ['focus-coverage']
 */
export function validateWeeklyProposal(
  proposal: WeeklyPlanValidationProposal,
  input: WeeklyPlanValidationInput,
): WeeklyPlanValidationResult {
  const issues = collectIssues(proposal, input);
  return {
    valid: issues.length === 0,
    failures: issues.map((issue) => issue.code),
    reasons: issues.map((issue) => issue.reason),
  };
}
