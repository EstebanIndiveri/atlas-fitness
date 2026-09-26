import { describe, expect, it } from '@jest/globals';

import type { RoutineDraftCatalogItem, RoutineDraftExercise, RoutineDraftSource } from './routine-draft-types';
import { validateWeeklyProposal } from './weekly-plan-week-validation';
import type {
  WeeklyPlanComposedDay,
  WeeklyPlanValidationInput,
  WeeklyPlanValidationProposal,
  WeeklyPlanWeekday,
} from './weekly-plan-week-types';

const GROUPS = ['Pecho', 'Espalda', 'Hombros', 'Piernas', 'Glúteos', 'Bíceps', 'Tríceps', 'Core'] as const;

const catalog: RoutineDraftCatalogItem[] = GROUPS.flatMap((muscleGroup, groupIndex) =>
  [0, 1].map((offset) => ({
    id: groupIndex * 2 + offset + 1,
    slug: `ejercicio-${groupIndex * 2 + offset + 1}`,
    name: `Ejercicio ${groupIndex * 2 + offset + 1}`,
    muscleGroup,
    instructions: 'Instrucciones del catálogo.',
    imageUrl: null,
    videoUrl: null,
    isSystem: true,
  })),
);

function exercise(
  exerciseId: number,
  muscleGroup: string,
  overrides: Partial<RoutineDraftExercise> = {},
): RoutineDraftExercise {
  return {
    exerciseId,
    exerciseName: `Ejercicio ${exerciseId}`,
    muscleGroup,
    sortOrder: 0,
    targetSets: 3,
    targetReps: 10,
    ...overrides,
  };
}

function day(
  dayOfWeek: WeeklyPlanWeekday,
  focus: string,
  focusAreas: readonly string[],
  exercises: readonly RoutineDraftExercise[],
  routineSource: RoutineDraftSource = 'fallback',
): WeeklyPlanComposedDay {
  return {
    dayOfWeek,
    title: `Día ${dayOfWeek}`,
    focus,
    focusAreas,
    routineSource,
    exercises: exercises.map((item, index) => ({ ...item, sortOrder: index })),
  };
}

function proposal(days: readonly WeeklyPlanComposedDay[]): WeeklyPlanValidationProposal {
  const scheduled = new Set<number>(days.map((item) => item.dayOfWeek));
  const week: readonly WeeklyPlanWeekday[] = [0, 1, 2, 3, 4, 5, 6];
  return { days, restDays: week.filter((weekday) => !scheduled.has(weekday)) };
}

function validationInput(overrides: Partial<WeeklyPlanValidationInput> = {}): WeeklyPlanValidationInput {
  return {
    goal: 'ganar fuerza',
    daysPerWeek: 3,
    sessionLengthMinutes: 60,
    focusAreas: [],
    catalog,
    ...overrides,
  };
}

const coherentWeek = proposal([
  day(1, 'Empuje', ['Pecho'], [exercise(1, 'Pecho'), exercise(2, 'Pecho')]),
  day(3, 'Tirón', ['Espalda'], [exercise(3, 'Espalda'), exercise(4, 'Espalda')]),
  day(5, 'Piernas', ['Piernas'], [exercise(7, 'Piernas'), exercise(9, 'Glúteos')]),
]);

describe('validateWeeklyProposal', () => {
  it('accepts a coherent week with rest days between sessions', () => {
    const result = validateWeeklyProposal(coherentWeek, validationInput());

    expect(result.valid).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.reasons).toEqual([]);
  });

  it('rejects a week with the wrong training day count or duplicated weekdays', () => {
    const short = validateWeeklyProposal(proposal(coherentWeek.days.slice(0, 2)), validationInput());
    const duplicated = validateWeeklyProposal(
      proposal([coherentWeek.days[0]!, coherentWeek.days[1]!, coherentWeek.days[1]!]),
      validationInput(),
    );

    expect(short.valid).toBe(false);
    expect(short.failures).toContain('training-day-count');
    expect(duplicated.valid).toBe(false);
    expect(duplicated.failures).toContain('duplicate-weekday');
  });

  it('rejects a week without rest or recovery distribution', () => {
    const everyDay = proposal(
      ([0, 1, 2, 3, 4, 5, 6] as const).map((weekday) =>
        day(weekday, 'Empuje', ['Pecho'], [exercise(1, 'Pecho')]),
      ),
    );
    const sixTrainingDays = proposal(
      ([1, 2, 3, 4, 5, 6] as const).map((weekday) => day(weekday, 'Empuje', ['Pecho'], [exercise(1, 'Pecho')])),
    );

    const noRest = validateWeeklyProposal(everyDay, validationInput({ daysPerWeek: 7 }));
    const noRecovery = validateWeeklyProposal(sixTrainingDays, validationInput({ daysPerWeek: 6 }));

    expect(noRest.valid).toBe(false);
    expect(noRest.failures).toContain('missing-recovery');
    expect(noRecovery.valid).toBe(false);
    expect(noRecovery.failures).toContain('insufficient-recovery');
  });

  it('accepts a scheduled recovery day instead of a second rest day', () => {
    const withRecovery = proposal([
      day(1, 'Empuje', ['Pecho'], [exercise(1, 'Pecho')]),
      day(2, 'Tirón', ['Espalda'], [exercise(3, 'Espalda')]),
      day(3, 'Piernas', ['Piernas'], [exercise(7, 'Piernas')]),
      day(4, 'Empuje', ['Pecho'], [exercise(2, 'Pecho')]),
      day(5, 'Tirón', ['Espalda'], [exercise(4, 'Espalda')]),
      day(6, 'Movilidad y recuperación', ['Core'], [exercise(15, 'Core')]),
    ]);

    const result = validateWeeklyProposal(withRecovery, validationInput({ daysPerWeek: 6 }));

    expect(result.valid).toBe(true);
  });

  it('rejects a recovery day that carries a full training session', () => {
    const week = (recoveryExercises: readonly RoutineDraftExercise[]) =>
      proposal([
        day(1, 'Empuje', ['Pecho'], [exercise(1, 'Pecho')]),
        day(2, 'Tirón', ['Espalda'], [exercise(3, 'Espalda')]),
        day(3, 'Piernas', ['Piernas'], [exercise(7, 'Piernas')]),
        day(4, 'Empuje', ['Pecho'], [exercise(2, 'Pecho')]),
        day(5, 'Tirón', ['Espalda'], [exercise(4, 'Espalda')]),
        day(6, 'Movilidad y recuperación', ['Core'], recoveryExercises),
      ]);

    const foreign = validateWeeklyProposal(
      week([exercise(15, 'Core'), exercise(1, 'Pecho')]),
      validationInput({ daysPerWeek: 6 }),
    );
    const bounded = validateWeeklyProposal(week([exercise(15, 'Core')]), validationInput({ daysPerWeek: 6 }));

    expect(foreign.valid).toBe(false);
    expect(foreign.failures).toContain('recovery-focus');
    expect(bounded.valid).toBe(true);
  });

  it('rejects a recovery day bound to training work instead of a genuine recovery group', () => {
    const dishonest = proposal([
      day(1, 'Empuje', ['Pecho'], [exercise(1, 'Pecho')]),
      day(2, 'Tirón', ['Espalda'], [exercise(3, 'Espalda')]),
      day(3, 'Piernas', ['Piernas'], [exercise(7, 'Piernas')]),
      day(4, 'Empuje', ['Pecho'], [exercise(2, 'Pecho')]),
      day(5, 'Tirón', ['Espalda'], [exercise(4, 'Espalda')]),
      day(6, 'Movilidad y recuperación', ['Piernas'], [exercise(9, 'Glúteos')]),
    ]);

    const result = validateWeeklyProposal(dishonest, validationInput({ daysPerWeek: 6 }));

    expect(result.valid).toBe(false);
    expect(result.failures).toContain('recovery-focus');
  });

  it('requires a genuine recovery point when the visible catalog exposes no recovery group', () => {
    const withoutRecoveryGroup = catalog.filter((item) => item.muscleGroup !== 'Core');
    const honest = proposal([
      day(1, 'Empuje', ['Pecho'], [exercise(1, 'Pecho')]),
      day(2, 'Tirón', ['Espalda'], [exercise(3, 'Espalda')]),
      day(3, 'Piernas', ['Piernas'], [exercise(7, 'Piernas')]),
      day(4, 'Empuje', ['Pecho'], [exercise(2, 'Pecho')]),
      day(5, 'Tirón', ['Espalda'], [exercise(4, 'Espalda')]),
      day(6, 'Piernas', ['Piernas'], [exercise(8, 'Piernas')]),
    ]);
    const labelledRecovery = proposal([
      day(0, 'Movilidad y recuperación', ['Piernas'], [exercise(9, 'Glúteos')]),
      day(1, 'Empuje', ['Pecho'], [exercise(1, 'Pecho')]),
      day(2, 'Tirón', ['Espalda'], [exercise(3, 'Espalda')]),
      day(3, 'Piernas', ['Piernas'], [exercise(7, 'Piernas')]),
      day(4, 'Empuje', ['Pecho'], [exercise(2, 'Pecho')]),
      day(5, 'Tirón', ['Espalda'], [exercise(4, 'Espalda')]),
      day(6, 'Piernas', ['Piernas'], [exercise(8, 'Piernas')]),
    ]);

    const honestResult = validateWeeklyProposal(
      honest,
      validationInput({ daysPerWeek: 6, catalog: withoutRecoveryGroup }),
    );
    const dishonestResult = validateWeeklyProposal(
      labelledRecovery,
      validationInput({ daysPerWeek: 7, catalog: withoutRecoveryGroup }),
    );

    expect(honestResult.valid).toBe(true);
    expect(honestResult.failures).toEqual([]);
    expect(dishonestResult.valid).toBe(false);
    expect(dishonestResult.failures).toContain('recovery-focus');
    expect(dishonestResult.failures).toContain('missing-recovery');
  });

  it('rejects a week that does not cover the requested or goal focus areas', () => {
    const requested = validateWeeklyProposal(coherentWeek, validationInput({ focusAreas: ['Piernas', 'Core'] }));
    const goal = validateWeeklyProposal(coherentWeek, validationInput({ goal: 'hipertrofia de bíceps' }));

    expect(requested.valid).toBe(false);
    expect(requested.failures).toContain('focus-coverage');
    expect(goal.valid).toBe(false);
    expect(goal.failures).toContain('focus-coverage');
  });

  it('rejects unrelated muscle groups and broad focus that is not justified', () => {
    const unrelated = validateWeeklyProposal(
      proposal([
        day(1, 'Piernas', ['Piernas'], [exercise(7, 'Piernas'), exercise(1, 'Pecho')]),
        day(3, 'Tirón', ['Espalda'], [exercise(3, 'Espalda')]),
        day(5, 'Piernas', ['Piernas'], [exercise(9, 'Glúteos')]),
      ]),
      validationInput(),
    );
    const broad = validateWeeklyProposal(
      proposal([
        day(1, 'Full body', [], [exercise(1, 'Pecho')]),
        day(3, 'Tirón', ['Espalda'], [exercise(3, 'Espalda')]),
        day(5, 'Piernas', ['Piernas'], [exercise(7, 'Piernas')]),
      ]),
      validationInput(),
    );

    expect(unrelated.valid).toBe(false);
    expect(unrelated.failures).toContain('unrelated-focus');
    expect(broad.valid).toBe(false);
    expect(broad.failures).toContain('unrelated-focus');
  });

  it('accepts a broad day when the visible catalog cannot cover every day', () => {
    const narrowCatalog: RoutineDraftCatalogItem[] = [catalog[0]!, catalog[6]!];
    const result = validateWeeklyProposal(
      proposal([
        day(1, 'Full body', [], [exercise(7, 'Piernas')]),
        day(3, 'Piernas', ['Piernas'], [exercise(7, 'Piernas')]),
        day(5, 'Full body', [], [exercise(1, 'Pecho')]),
      ]),
      validationInput({ catalog: narrowCatalog }),
    );

    expect(result.valid).toBe(true);
  });

  it('rejects repeated exercise work across distinct sessions but allows it within the same focus', () => {
    const acrossSessions = validateWeeklyProposal(
      proposal([
        day(1, 'Empuje', ['Pecho'], [exercise(1, 'Pecho')]),
        day(3, 'Tirón', ['Espalda'], [exercise(1, 'Pecho')]),
        day(5, 'Piernas', ['Piernas'], [exercise(1, 'Pecho')]),
      ]),
      validationInput(),
    );
    const sameFocus = validateWeeklyProposal(
      proposal([
        day(1, 'Piernas', ['Piernas'], [exercise(7, 'Piernas')]),
        day(3, 'Piernas', ['Piernas'], [exercise(7, 'Piernas')]),
        day(5, 'Piernas', ['Piernas'], [exercise(7, 'Piernas'), exercise(9, 'Glúteos')]),
      ]),
      validationInput({ focusAreas: ['Piernas'] }),
    );

    expect(acrossSessions.valid).toBe(false);
    expect(acrossSessions.failures).toContain('repeated-exercise');
    expect(sameFocus.valid).toBe(true);
  });

  it('rejects unreasonable weekly volume', () => {
    const heavyDay = proposal([
      day(1, 'Empuje', ['Pecho'], [
        exercise(1, 'Pecho', { targetSets: 8 }),
        exercise(2, 'Pecho', { targetSets: 8 }),
      ]),
      day(3, 'Tirón', ['Espalda'], [exercise(3, 'Espalda')]),
      day(5, 'Piernas', ['Piernas'], [exercise(7, 'Piernas')]),
    ]);

    const result = validateWeeklyProposal(heavyDay, validationInput());

    expect(result.valid).toBe(false);
    expect(result.failures).toContain('weekly-volume');
  });

  it('rejects any exercise id that is not part of the visible catalog', () => {
    const result = validateWeeklyProposal(
      proposal([
        day(1, 'Empuje', ['Pecho'], [exercise(1, 'Pecho')]),
        day(3, 'Tirón', ['Espalda'], [exercise(999, 'Espalda')]),
        day(5, 'Piernas', ['Piernas'], [exercise(7, 'Piernas')]),
      ]),
      validationInput(),
    );

    expect(result.valid).toBe(false);
    expect(result.failures).toContain('unknown-exercise');
  });

  it('requires only the labels a single session can schedule', () => {
    const requested = ['Piernas', 'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps'] as const;
    const covered = proposal([
      day(1, 'Piernas y Pecho y Espalda', [...requested], [
        exercise(7, 'Piernas', { targetSets: 2 }),
        exercise(1, 'Pecho', { targetSets: 2 }),
        exercise(3, 'Espalda', { targetSets: 2 }),
        exercise(5, 'Hombros', { targetSets: 2 }),
        exercise(11, 'Bíceps', { targetSets: 2 }),
        exercise(13, 'Tríceps', { targetSets: 2 }),
      ]),
    ]);
    const missingTriceps = proposal([
      day(1, 'Piernas y Pecho y Espalda', ['Piernas', 'Pecho', 'Espalda', 'Hombros', 'Bíceps'], [
        exercise(7, 'Piernas', { targetSets: 2 }),
        exercise(1, 'Pecho', { targetSets: 2 }),
        exercise(3, 'Espalda', { targetSets: 2 }),
        exercise(5, 'Hombros', { targetSets: 2 }),
        exercise(11, 'Bíceps', { targetSets: 2 }),
      ]),
    ]);

    const accepted = validateWeeklyProposal(covered, validationInput({ daysPerWeek: 1, focusAreas: [...requested] }));
    const rejected = validateWeeklyProposal(
      missingTriceps,
      validationInput({ daysPerWeek: 1, focusAreas: [...requested] }),
    );

    expect(accepted.valid).toBe(true);
    expect(rejected.valid).toBe(false);
    expect(rejected.failures).toContain('focus-coverage');
  });

  it('reports the capacity bound instead of demanding the labels beyond it', () => {
    const requested = Array.from({ length: 10 }, (_, index) => `Grupo ${index + 1}`);
    const tenGroupCatalog: RoutineDraftCatalogItem[] = requested.map((muscleGroup, index) => ({
      id: 100 + index,
      slug: `grupo-${index + 1}`,
      name: `Ejercicio grupo ${index + 1}`,
      muscleGroup,
      instructions: 'Instrucciones del catálogo.',
      imageUrl: null,
      videoUrl: null,
      isSystem: true,
    }));
    const week = proposal([
      day(
        1,
        'Grupo 1 a 5',
        requested.slice(0, 5),
        requested.slice(0, 5).map((muscleGroup, index) =>
          exercise(100 + index, muscleGroup, { targetSets: 2 }),
        ),
      ),
    ]);

    const result = validateWeeklyProposal(
      week,
      validationInput({ daysPerWeek: 1, focusAreas: requested, catalog: tenGroupCatalog }),
    );
    const coverageReason = result.reasons.find((reason) => reason.includes('foco pedido'));

    expect(result.valid).toBe(false);
    expect(result.failures).toContain('focus-coverage');
    expect(coverageReason).toContain('Grupo 6');
    expect(coverageReason).toContain('primeros 6 de 10');
    expect(coverageReason).not.toContain('Grupo 7');
  });

  it('reports every problem found in one pass instead of the first one', () => {
    const broken = proposal([
      day(1, 'Empuje', ['Pecho'], [exercise(1, 'Pecho')]),
      day(1, 'Piernas', ['Piernas'], [exercise(999, 'Pecho')]),
    ]);

    const result = validateWeeklyProposal(broken, validationInput());

    expect(result.valid).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining(['training-day-count', 'duplicate-weekday', 'unknown-exercise', 'unrelated-focus']),
    );
    expect(result.reasons).toHaveLength(result.failures.length);
  });
});
