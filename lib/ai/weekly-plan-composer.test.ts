import { describe, expect, it, jest } from '@jest/globals';

import { db } from '@/lib/db/client';
import { guidedTrainingPlanSaves, routines, scheduledRoutines, trainingPlans } from '@/lib/db/schema';
import { AppError } from '@/types/errors';

import { matchesMuscleGroup, normalizeFocusLabel } from './weekly-plan-focus';
import { composeWeeklyPlanProposal } from './weekly-plan-composer';
import type { RoutineDraft, RoutineDraftCatalogItem, RoutineDraftContext } from './routine-draft-types';
import type { WeeklyPlanComposerInput, WeeklyPlanComposerDraft, WeeklyPlanRoutineEngine } from './weekly-plan-week-types';

const GROUPS = ['Pecho', 'Espalda', 'Hombros', 'Piernas', 'Glúteos', 'Bíceps', 'Tríceps', 'Core'] as const;
const UPPER_BODY = new Set(['pecho', 'espalda', 'hombros', 'biceps', 'triceps']);

const catalog: RoutineDraftCatalogItem[] = GROUPS.flatMap((muscleGroup, groupIndex) =>
  [0, 1, 2].map((offset) => ({
    id: groupIndex * 3 + offset + 1,
    slug: `ejercicio-${groupIndex * 3 + offset + 1}`,
    name: `Ejercicio ${groupIndex * 3 + offset + 1}`,
    muscleGroup,
    instructions: 'Instrucciones del catálogo.',
    imageUrl: null,
    videoUrl: null,
    isSystem: true,
  })),
);

function brief(overrides: Partial<WeeklyPlanComposerInput> = {}): WeeklyPlanComposerInput {
  return {
    goal: 'ganar fuerza',
    daysPerWeek: 3,
    experience: 'intermediate',
    availableEquipment: ['gimnasio completo'],
    sessionLengthMinutes: 55,
    focusAreas: [],
    catalog,
    ...overrides,
  };
}

const legsBrief = (): WeeklyPlanComposerInput =>
  brief({ goal: 'hipertrofia de piernas', daysPerWeek: 2, focusAreas: ['Piernas'] });

function weekdaysOf(draft: WeeklyPlanComposerDraft): number[] {
  return draft.days.map((day) => day.dayOfWeek);
}

function restDaysOf(draft: WeeklyPlanComposerDraft): number[] {
  const scheduled = new Set(weekdaysOf(draft));
  return [0, 1, 2, 3, 4, 5, 6].filter((weekday) => !scheduled.has(weekday));
}

function routineFor(context: RoutineDraftContext): RoutineDraft {
  const focused = context.catalog.filter((item) =>
    context.focusAreas.some((focus) => matchesMuscleGroup(focus, item.muscleGroup)),
  );
  const exercises = (focused.length > 0 ? focused : context.catalog).slice(0, 3).map((item, index) => ({
    exerciseId: item.id,
    exerciseName: item.name,
    muscleGroup: item.muscleGroup,
    sortOrder: index,
    targetSets: 2,
    targetReps: 10,
  }));
  return {
    source: 'fallback',
    name: 'Rutina de prueba',
    description: 'Sesión de prueba.',
    reason: 'Selección de prueba.',
    kind: context.location,
    restSeconds: 90,
    exercises,
  };
}

function createEngineStub(
  build: (context: RoutineDraftContext, index: number) => RoutineDraft = (context) => routineFor(context),
): { engine: WeeklyPlanRoutineEngine; calls: RoutineDraftContext[] } {
  const calls: RoutineDraftContext[] = [];
  const engine: WeeklyPlanRoutineEngine = async (context) => {
    calls.push(context);
    return build(context, calls.length - 1);
  };
  return { engine, calls };
}

function geminiRoutineText(payload: unknown): Response {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
  } as Response;
}

describe('composeWeeklyPlanProposal', () => {
  it('composes one coherent week with a complete routine for every training day', async () => {
    const draft = await composeWeeklyPlanProposal(brief({ daysPerWeek: 3 }));

    expect(draft.source).toBe('fallback');
    expect(draft.goal).toBe('ganar fuerza');
    expect(draft.name.length).toBeGreaterThan(0);
    expect(weekdaysOf(draft)).toHaveLength(3);
    expect(new Set(weekdaysOf(draft)).size).toBe(3);
    expect(restDaysOf(draft).length).toBeGreaterThanOrEqual(2);
    expect(draft.days.every((day) => day.title.length > 0 && day.focus.length > 0)).toBe(true);

    for (const day of draft.days) {
      expect(day.exercises.length).toBeGreaterThan(0);
      expect(day.exercises.map((item) => item.sortOrder)).toEqual(day.exercises.map((_item, index) => index));
      expect(day.exercises.every((item) => item.targetSets >= 1 && item.targetSets <= 8)).toBe(true);
      expect(day.exercises.every((item) => item.targetReps >= 1 && item.targetReps <= 30)).toBe(true);
      expect(day.exercises.every((item) => catalog.some((entry) => entry.id === item.exerciseId))).toBe(true);
      expect(day.exercises.every((item) => matchesMuscleGroup(day.focus, item.muscleGroup))).toBe(true);
    }
  });

  it.each([1, 6])('honours a %i day week with unique weekdays and rest or recovery distribution', async (daysPerWeek) => {
    const draft = await composeWeeklyPlanProposal(brief({ daysPerWeek }));

    expect(draft.days).toHaveLength(daysPerWeek);
    expect(new Set(weekdaysOf(draft)).size).toBe(daysPerWeek);
    expect(restDaysOf(draft).length >= 2 || draft.days.some((day) => /movilidad/i.test(day.focus))).toBe(true);
    expect(draft.days.every((day) => day.exercises.length > 0)).toBe(true);
  });

  it('binds the recovery session of a six day week to recovery work only', async () => {
    const draft = await composeWeeklyPlanProposal(
      brief({ goal: 'hipertrofia de piernas', daysPerWeek: 6, focusAreas: ['Piernas'] }),
    );
    const recoveryDays = draft.days.filter((day) => /movilidad/i.test(day.focus));
    const trainingDays = draft.days.filter((day) => !/movilidad/i.test(day.focus));
    const recoveryGroups = (recoveryDays[0]?.exercises ?? []).map((item) =>
      normalizeFocusLabel(item.muscleGroup),
    );

    expect(recoveryDays).toHaveLength(1);
    expect(trainingDays).toHaveLength(5);
    expect(recoveryGroups.length).toBeGreaterThan(0);
    expect(recoveryGroups.every((group) => group === 'core')).toBe(true);
    expect(
      trainingDays
        .flatMap((day) => day.exercises.map((item) => normalizeFocusLabel(item.muscleGroup)))
        .every((group) => group === 'piernas' || group === 'gluteos'),
    ).toBe(true);
  });

  it('keeps a two day legs plan on the lower body without a hardcoded split', async () => {
    const draft = await composeWeeklyPlanProposal(legsBrief());
    const muscleGroups = draft.days.flatMap((day) => day.exercises.map((item) => normalizeFocusLabel(item.muscleGroup)));

    expect(draft.source).toBe('fallback');
    expect(draft.days).toHaveLength(2);
    expect(new Set(weekdaysOf(draft)).size).toBe(2);
    expect(draft.days.map((day) => normalizeFocusLabel(day.focus))).toEqual(['piernas', 'piernas']);
    expect(muscleGroups.every((group) => group === 'piernas' || group === 'gluteos')).toBe(true);
    expect(muscleGroups.some((group) => UPPER_BODY.has(group) || group === 'core')).toBe(false);

    const pushDraft = await composeWeeklyPlanProposal(
      brief({ goal: 'hipertrofia de espalda', daysPerWeek: 2, focusAreas: ['Espalda'] }),
    );
    expect(pushDraft.days.map((day) => normalizeFocusLabel(day.focus))).toEqual(['espalda', 'espalda']);
    expect(
      pushDraft.days
        .flatMap((day) => day.exercises.map((item) => normalizeFocusLabel(item.muscleGroup)))
        .every((group) => group === 'espalda'),
    ).toBe(true);
  });

  it('derives the week from the goal when the brief has no focus areas', async () => {
    const draft = await composeWeeklyPlanProposal(brief({ goal: 'hipertrofia de piernas', daysPerWeek: 3 }));

    expect(draft.days.map((day) => normalizeFocusLabel(day.focus))).toEqual(['piernas', 'gluteos', 'piernas']);
    expect(
      draft.days
        .flatMap((day) => day.exercises.map((item) => normalizeFocusLabel(item.muscleGroup)))
        .every((group) => group === 'piernas' || group === 'gluteos'),
    ).toBe(true);
  });

  it('composes with a single requested focus area and with an unusable equipment brief', async () => {
    const short = await composeWeeklyPlanProposal(brief({ daysPerWeek: 2, focusAreas: ['Piernas'] }));
    const unavailable = await composeWeeklyPlanProposal(brief({ availableEquipment: ['heladera', 'silla'] }));

    expect(short.days.map((day) => normalizeFocusLabel(day.focus))).toEqual(['piernas', 'piernas']);
    expect(unavailable.days).toHaveLength(3);
    expect(unavailable.days.every((day) => day.exercises.length > 0)).toBe(true);
  });

  it.each([20, 120])('composes a complete week for a %i minute session', async (sessionLengthMinutes) => {
    const draft = await composeWeeklyPlanProposal(brief({ sessionLengthMinutes, daysPerWeek: 3 }));

    expect(draft.days).toHaveLength(3);
    for (const day of draft.days) {
      const totalSets = day.exercises.reduce((sum, item) => sum + item.targetSets, 0);
      expect(day.exercises.length).toBeGreaterThan(0);
      expect(totalSets).toBeLessThanOrEqual(sessionLengthMinutes === 20 ? 4 : 24);
    }
  });

  it('recomposes deterministically when the Gemini strategy is incoherent', async () => {
    const fetchImpl = jest.fn<typeof fetch>().mockResolvedValue(
      geminiRoutineText({ weekPattern: [{ dayOfWeek: 1, focus: 'Crossfit' }] }),
    );

    const draft = await composeWeeklyPlanProposal(brief({ daysPerWeek: 3 }), {
      env: { GEMINI_API_KEY: 'test-key' },
      fetchImpl,
    });
    const deterministic = await composeWeeklyPlanProposal(brief({ daysPerWeek: 3 }));

    expect(fetchImpl).toHaveBeenCalled();
    expect(draft).toEqual(deterministic);
    expect(draft.source).toBe('fallback');
  });

  it('recomposes deterministically when a coherent Gemini week fails weekly validation', async () => {
    const fetchImpl = jest.fn<typeof fetch>().mockResolvedValue(
      geminiRoutineText({
        weekPattern: [
          { dayOfWeek: 1, focus: 'Piernas' },
          { dayOfWeek: 3, focus: 'Movilidad y recuperación' },
          { dayOfWeek: 5, focus: 'Piernas' },
        ],
      }),
    );
    const { engine, calls } = createEngineStub((context) =>
      context.focusAreas.some((area) => normalizeFocusLabel(area) === 'core')
        ? {
            ...routineFor(context),
            exercises: [
              {
                exerciseId: 1,
                exerciseName: 'Ejercicio 1',
                muscleGroup: 'Pecho',
                sortOrder: 0,
                targetSets: 2,
                targetReps: 10,
              },
            ],
          }
        : routineFor(context),
    );

    const draft = await composeWeeklyPlanProposal(
      brief({ goal: 'hipertrofia de piernas', daysPerWeek: 3, focusAreas: ['Piernas'] }),
      { env: { GEMINI_API_KEY: 'test-key' }, fetchImpl, buildRoutineDraft: engine },
    );

    expect(fetchImpl).toHaveBeenCalled();
    expect(calls).toHaveLength(draft.days.length * 2);
    expect(draft.source).toBe('fallback');
    expect(draft.days.map((day) => normalizeFocusLabel(day.focus))).toEqual([
      'piernas',
      'piernas',
      'piernas',
    ]);
  });

  it('keeps the weekdays of a coherent Gemini strategy and attributes the proposal to Gemini', async () => {
    const fetchImpl = jest.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const body = typeof init?.body === 'string' ? init.body : '';
      if (!body.includes('weekPattern')) return { ok: false } as Response;
      return geminiRoutineText({
        weekPattern: [
          { dayOfWeek: 2, focus: 'Piernas' },
          { dayOfWeek: 4, focus: 'Piernas' },
        ],
      });
    });

    const draft = await composeWeeklyPlanProposal(legsBrief(), {
      env: { GEMINI_API_KEY: 'test-key' },
      fetchImpl,
    });

    expect(draft.source).toBe('gemini');
    expect(weekdaysOf(draft)).toEqual([2, 4]);
    expect(draft.days.every((day) => day.exercises.length > 0)).toBe(true);
  });

  it('delegates every training day to the shared Routine Engine V2', async () => {
    const { engine, calls } = createEngineStub();
    const request = brief({ goal: 'ganar fuerza', daysPerWeek: 3, focusAreas: ['Piernas', 'Espalda'] });

    const draft = await composeWeeklyPlanProposal(request, { buildRoutineDraft: engine });

    expect(calls).toHaveLength(3);
    expect(calls.map((context) => context.focusAreas)).toEqual([['Piernas'], ['Espalda'], ['Piernas']]);
    expect(draft.days.map((day) => day.focus)).toEqual(['Piernas', 'Espalda', 'Piernas']);
    for (const context of calls) {
      expect(context.goal).toBe('ganar fuerza');
      expect(context.level).toBe('intermediate');
      expect(context.sessionLengthMinutes).toBe(55);
      expect(context.location).toBe('gym');
      expect(context.catalog).toBe(catalog);
      expect(context).not.toHaveProperty('availableEquipment');
    }
  });

  it('returns the exercise metadata enriched by the shared engine instead of rebuilding it', async () => {
    const draft = await composeWeeklyPlanProposal(brief({ daysPerWeek: 1, focusAreas: ['Piernas'] }));
    const day = draft.days[0]!;

    expect(day.exercises.length).toBeGreaterThan(0);
    for (const item of day.exercises) {
      const source = catalog.find((entry) => entry.id === item.exerciseId);
      expect(item.exerciseName).toBe(source?.name);
      expect(item.muscleGroup).toBe(source?.muscleGroup);
      expect(item.instructions).toBe(source?.instructions);
    }
  });

  it('rejects an incomplete engine day instead of returning a partial week', async () => {
    const { engine } = createEngineStub((context) => ({ ...routineFor(context), exercises: [] }));

    await expect(
      composeWeeklyPlanProposal(brief({ daysPerWeek: 3 }), { buildRoutineDraft: engine }),
    ).rejects.toThrow(/incompleta/i);
  });

  it('rejects an engine day that ignores the day focus instead of returning a partial week', async () => {
    const { engine } = createEngineStub((context) => ({
      ...routineFor(context),
      exercises: [
        { exerciseId: 1, exerciseName: 'Ejercicio 1', muscleGroup: 'Pecho', sortOrder: 0, targetSets: 2, targetReps: 10 },
      ],
    }));

    const rejection = await composeWeeklyPlanProposal(legsBrief(), { buildRoutineDraft: engine }).catch(
      (error: unknown) => error,
    );

    expect(rejection).toBeInstanceOf(AppError);
    expect((rejection as AppError).code).toBe('VALIDATION');
    expect((rejection as AppError).message).toMatch(/no corresponden al foco/i);
  });

  it('rejects exercises outside the visible catalog', async () => {
    const { engine } = createEngineStub((context) => ({
      ...routineFor(context),
      exercises: [
        { exerciseId: 999, exerciseName: 'Inventado', muscleGroup: 'Piernas', sortOrder: 0, targetSets: 2, targetReps: 10 },
      ],
    }));

    await expect(
      composeWeeklyPlanProposal(legsBrief(), { buildRoutineDraft: engine }),
    ).rejects.toThrow(/catálogo visible/i);
  });

  it('surfaces the engine domain error instead of fabricating a routine', async () => {
    const engineError = new AppError(
      'VALIDATION',
      'El catálogo no tiene metadatos verificados para validar el equipamiento indicado.',
    );
    const engine: WeeklyPlanRoutineEngine = async () => {
      throw engineError;
    };

    const rejection = await composeWeeklyPlanProposal(brief({ daysPerWeek: 2 }), { buildRoutineDraft: engine }).catch(
      (error: unknown) => error,
    );

    expect(rejection).toBe(engineError);
  });

  it('surfaces a domain error when the visible catalog is empty', async () => {
    await expect(composeWeeklyPlanProposal(brief({ catalog: [] }))).rejects.toThrow(/c[oó]digo|catálogo/i);
  });

  it.each([
    ['a zero day week', { daysPerWeek: 0 }],
    ['a seven day week', { daysPerWeek: 7 }],
    ['a blank goal', { goal: '' }],
    ['an impossible session length', { sessionLengthMinutes: 0 }],
  ])('rejects %s', async (_label, overrides) => {
    await expect(composeWeeklyPlanProposal(brief(overrides))).rejects.toThrow(AppError);
  });

  it('never persists plans, routines or scheduled assignments', async () => {
    const countRows = async (): Promise<Record<string, number>> => ({
      plans: (await db.select({ id: trainingPlans.id }).from(trainingPlans)).length,
      routines: (await db.select({ id: routines.id }).from(routines)).length,
      scheduled: (await db.select({ id: scheduledRoutines.id }).from(scheduledRoutines)).length,
      saves: (await db.select({ id: guidedTrainingPlanSaves.id }).from(guidedTrainingPlanSaves)).length,
    });
    const before = await countRows();

    const draft = await composeWeeklyPlanProposal(brief({ daysPerWeek: 3 }));

    expect(draft.days.length).toBeGreaterThan(0);
    expect(await countRows()).toEqual(before);
  });
});
