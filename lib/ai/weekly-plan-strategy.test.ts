import { describe, expect, it, jest } from '@jest/globals';

import type { RoutineDraftCatalogItem } from './routine-draft-types';
import {
  expandLowerBodyLabels,
  goalFocusLabels,
  inferWeeklyLocation,
  isRecoveryFocus,
  listCatalogMuscleGroups,
  matchesMuscleGroup,
  normalizeFocusLabel,
  resolveFocusAreas,
} from './weekly-plan-focus';
import {
  buildDeterministicWeeklyStrategy,
  isCoherentWeeklyStrategy,
  requestGeminiWeeklyStrategy,
  resolveWeeklyStrategy,
} from './weekly-plan-strategy';
import type { WeeklyPlanStrategy, WeeklyPlanStrategyInput } from './weekly-plan-week-types';

const GROUPS = ['Pecho', 'Espalda', 'Hombros', 'Piernas', 'Glúteos', 'Bíceps', 'Tríceps', 'Core'] as const;

const catalog: RoutineDraftCatalogItem[] = GROUPS.map((muscleGroup, index) => ({
  id: index + 1,
  slug: `ejercicio-${index + 1}`,
  name: `Ejercicio ${index + 1}`,
  muscleGroup,
  instructions: 'Instrucciones del catálogo.',
  imageUrl: null,
  videoUrl: null,
  isSystem: true,
}));

function strategyInput(overrides: Partial<WeeklyPlanStrategyInput> = {}): WeeklyPlanStrategyInput {
  return {
    goal: 'ganar fuerza',
    daysPerWeek: 3,
    experience: 'intermediate',
    sessionLengthMinutes: 55,
    availableEquipment: ['gimnasio completo'],
    focusAreas: [],
    catalog,
    ...overrides,
  };
}

function geminiStrategyResponse(payload: unknown, ok = true): ReturnType<typeof jest.fn<typeof fetch>> {
  return jest.fn<typeof fetch>().mockResolvedValue({
    ok,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  } as Response);
}

function weekPattern(days: readonly { dayOfWeek: number; focus: string }[]): { weekPattern: unknown } {
  return { weekPattern: days };
}

describe('weekly plan focus helpers', () => {
  it('normalizes accents and resolves requested focus areas against the catalog', () => {
    expect(normalizeFocusLabel('  Piernas ')).toBe('piernas');
    expect(resolveFocusAreas('Piernas', catalog)).toEqual(['Piernas']);
    expect(resolveFocusAreas('gluteos', catalog)).toEqual(['Glúteos']);
    expect(resolveFocusAreas('Full body', catalog)).toEqual([]);
  });

  it('treats lower body areas as coherent with every lower body muscle group', () => {
    expect(matchesMuscleGroup('Piernas', 'Piernas')).toBe(true);
    expect(matchesMuscleGroup('piernas', 'Glúteos')).toBe(true);
    expect(matchesMuscleGroup('Piernas', 'Pecho')).toBe(false);
    expect(matchesMuscleGroup('Pecho', 'Espalda')).toBe(false);
    expect(expandLowerBodyLabels(['Piernas'], catalog)).toEqual(['Piernas', 'Glúteos']);
    expect(expandLowerBodyLabels(['Pecho'], catalog)).toEqual(['Pecho']);
  });

  it('derives goal focus labels from the goal text in catalog order', () => {
    expect(goalFocusLabels('hipertrofia de piernas', catalog)).toEqual(['Piernas']);
    expect(goalFocusLabels('hipertrofia de pecho y espalda', catalog)).toEqual(['Pecho', 'Espalda']);
    expect(goalFocusLabels('mejorar condición general', catalog)).toEqual([]);
  });

  it('lists catalog muscle groups once and detects recovery focuses', () => {
    expect(listCatalogMuscleGroups(catalog)).toEqual([...GROUPS]);
    expect(listCatalogMuscleGroups([...catalog, { ...catalog[0]!, id: 99, slug: 'otro' }])).toEqual([...GROUPS]);
    expect(isRecoveryFocus('Movilidad y recuperación')).toBe(true);
    expect(isRecoveryFocus('Piernas')).toBe(false);
  });

  it('infers the weekly location from the equipment brief', () => {
    expect(inferWeeklyLocation(['Gimnasio completo'])).toBe('gym');
    expect(inferWeeklyLocation(['mancuernas', 'banco'])).toBe('gym');
    expect(inferWeeklyLocation(['peso corporal', 'bandas elásticas'])).toBe('home');
    expect(inferWeeklyLocation([])).toBe('home');
  });

  it('resolves the singular lower body labels of the routine engine vocabulary', () => {
    const engineGroups = ['Piernas', 'Glúteo', 'Femorales', 'Gemelos', 'Pantorrilla'];
    const engineCatalog: RoutineDraftCatalogItem[] = engineGroups.map((muscleGroup, index) => ({
      ...catalog[0]!,
      id: index + 1,
      slug: `engine-${index + 1}`,
      muscleGroup,
    }));

    expect(resolveFocusAreas('gluteo', catalog)).toEqual(['Glúteos']);
    expect(resolveFocusAreas('femorales', catalog)).toEqual([]);
    expect(resolveFocusAreas('piernas', engineCatalog)).toEqual(['Piernas']);
    expect(expandLowerBodyLabels(['Piernas'], engineCatalog)).toEqual(engineGroups);
    expect(matchesMuscleGroup('Piernas', 'Femorales')).toBe(true);
  });
});

describe('buildDeterministicWeeklyStrategy', () => {
  it.each([1, 2, 3, 4, 5, 6])(
    'creates exactly %i unique training weekdays and keeps every other day as recovery',
    (daysPerWeek) => {
      const strategy = buildDeterministicWeeklyStrategy(strategyInput({ daysPerWeek }));
      const weekdays = strategy.days.map((day) => day.dayOfWeek);

      expect(strategy.source).toBe('fallback');
      expect(strategy.days).toHaveLength(daysPerWeek);
      expect(new Set(weekdays).size).toBe(daysPerWeek);
      expect(weekdays.every((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)).toBe(true);
      expect(strategy.restDays).toHaveLength(7 - daysPerWeek);
      expect(strategy.restDays.some((weekday) => weekdays.includes(weekday))).toBe(false);
      expect(strategy.days.every((day) => day.focus.length > 0 && day.title.length > 0)).toBe(true);
    },
  );

  it('keeps up to four sessions inside the Monday to Friday window', () => {
    for (const daysPerWeek of [1, 2, 3, 4]) {
      const weekdays = buildDeterministicWeeklyStrategy(strategyInput({ daysPerWeek }))
        .days.map((day) => day.dayOfWeek)
        .sort((left, right) => left - right);

      expect(weekdays).toHaveLength(daysPerWeek);
      expect(new Set(weekdays).size).toBe(daysPerWeek);
      expect(weekdays.every((weekday) => weekday >= 1 && weekday <= 5)).toBe(true);
    }

    expect(
      buildDeterministicWeeklyStrategy(strategyInput({ daysPerWeek: 4 })).days.map((day) => day.dayOfWeek),
    ).toEqual([1, 2, 4, 5]);
  });

  it('keeps the Monday to Friday contract used by the guided flow', () => {
    expect(
      buildDeterministicWeeklyStrategy(strategyInput({ daysPerWeek: 5 })).days.map((day) => day.dayOfWeek),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it('rotates the requested focus areas instead of a fixed split', () => {
    const strategy = buildDeterministicWeeklyStrategy(
      strategyInput({ daysPerWeek: 4, focusAreas: ['Piernas', 'Espalda'] }),
    );

    expect(strategy.days.map((day) => day.focus)).toEqual(['Piernas', 'Espalda', 'Piernas', 'Espalda']);
    expect(strategy.days.map((day) => day.focusAreas)).toEqual([
      ['Piernas'],
      ['Espalda'],
      ['Piernas'],
      ['Espalda'],
    ]);
  });

  it('derives a goal aware distribution when the brief has no focus areas', () => {
    const legs = buildDeterministicWeeklyStrategy(strategyInput({ daysPerWeek: 3, goal: 'hipertrofia de piernas' }));

    expect(legs.days.map((day) => day.focus)).toEqual(['Piernas', 'Glúteos', 'Piernas']);
    expect(legs.days.every((day) => day.focusAreas.length > 0)).toBe(true);

    const upper = buildDeterministicWeeklyStrategy(
      strategyInput({ daysPerWeek: 3, goal: 'hipertrofia de pecho y espalda' }),
    );
    expect(upper.days.map((day) => normalizeFocusLabel(day.focus))).toEqual(['pecho', 'espalda', 'pecho']);

    const open = buildDeterministicWeeklyStrategy(strategyInput({ daysPerWeek: 3, goal: 'mejorar condición general' }));
    expect(open.days.map((day) => day.focusAreas)).toEqual([
      ['Pecho', 'Espalda', 'Hombros'],
      ['Piernas', 'Glúteos', 'Bíceps'],
      ['Tríceps', 'Core'],
    ]);
    expect(open.days.map((day) => day.focus)).toEqual([
      'Pecho, Espalda y Hombros',
      'Piernas, Glúteos y Bíceps',
      'Tríceps y Core',
    ]);
  });

  it('covers every requested focus label when the brief lists more areas than training days', () => {
    const brief = strategyInput({
      goal: 'hipertrofia de piernas',
      daysPerWeek: 2,
      focusAreas: ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps'],
    });
    const strategy = buildDeterministicWeeklyStrategy(brief);
    const covered = (label: string): boolean =>
      strategy.days.some((day) => day.focusAreas.some((area) => matchesMuscleGroup(area, label)));

    expect(strategy.days).toHaveLength(2);
    expect(strategy.days.every((day) => day.focusAreas.length > 0 && day.focusAreas.length <= 6)).toBe(true);
    expect(['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps'].every(covered)).toBe(true);
    expect(isCoherentWeeklyStrategy(strategy, brief)).toBe(true);

    const singleDay = strategyInput({ goal: 'hipertrofia', daysPerWeek: 1, focusAreas: ['Piernas', 'Pecho', 'Core'] });
    const oneDayStrategy = buildDeterministicWeeklyStrategy(singleDay);

    expect(oneDayStrategy.days).toHaveLength(1);
    expect(oneDayStrategy.days[0]?.focusAreas).toEqual(['Piernas', 'Pecho', 'Core']);
    expect(oneDayStrategy.days[0]?.focus).toBe('Piernas, Pecho y Core');
    expect(isCoherentWeeklyStrategy(oneDayStrategy, singleDay)).toBe(true);
  });

  it('stays coherent for every accepted brief and training day count', () => {
    const briefs: readonly WeeklyPlanStrategyInput[] = [
      strategyInput(),
      strategyInput({ goal: 'hipertrofia de piernas', focusAreas: ['Piernas'] }),
      strategyInput({ goal: 'mejorar condición general' }),
      strategyInput({ goal: 'hipertrofia', focusAreas: ['Piernas', 'Pecho', 'Core'] }),
      strategyInput({ goal: 'hipertrofia de pecho y espalda' }),
    ];

    for (const base of briefs) {
      for (const daysPerWeek of [1, 2, 3, 4, 5, 6]) {
        const brief = { ...base, daysPerWeek };
        const strategy = buildDeterministicWeeklyStrategy(brief);

        expect(isCoherentWeeklyStrategy(strategy, brief)).toBe(true);
        expect(strategy.days.every((day) => day.focusAreas.length > 0)).toBe(true);
        expect(strategy.days.every((day) => day.focusAreas.length <= 6)).toBe(true);
      }
    }
  });

  it('adds a recovery focused day when the schedule leaves no rest time', () => {
    const strategy = buildDeterministicWeeklyStrategy(strategyInput({ daysPerWeek: 6 }));
    const scheduled = strategy.days.map((day) => day.dayOfWeek);
    const recoveryDays = scheduled.filter((weekday) =>
      isRecoveryFocus(strategy.days.find((day) => day.dayOfWeek === weekday)!.focus),
    );

    expect(strategy.restDays).toEqual([0]);
    expect(recoveryDays).toEqual([6]);
    expect(strategy.days.filter((day) => !isRecoveryFocus(day.focus))).toHaveLength(5);
  });

  it('only schedules a recovery day when the visible catalog exposes a recovery group', () => {
    const withoutRecoveryGroups: RoutineDraftCatalogItem[] = catalog.filter(
      (item) => item.muscleGroup !== 'Core',
    );
    const recoveryDay = buildDeterministicWeeklyStrategy(strategyInput({ daysPerWeek: 6 })).days[5]!;
    const honestWeek = buildDeterministicWeeklyStrategy(
      strategyInput({ daysPerWeek: 6, focusAreas: ['Piernas'], catalog: withoutRecoveryGroups }),
    );

    expect(recoveryDay.focus).toBe('Movilidad y recuperación');
    expect(recoveryDay.focusAreas).toEqual(['Core']);

    expect(honestWeek.days).toHaveLength(6);
    expect(honestWeek.days.filter((day) => isRecoveryFocus(day.focus))).toEqual([]);
    expect(honestWeek.days.every((day) => day.focusAreas.length > 0)).toBe(true);
    expect(honestWeek.restDays).toEqual([0]);
  });

  it('ignores focus areas missing from the catalog', () => {
    const strategy = buildDeterministicWeeklyStrategy(
      strategyInput({ daysPerWeek: 2, focusAreas: ['Crossfit'], goal: 'hipertrofia de piernas' }),
    );

    expect(strategy.days.map((day) => day.focus)).toEqual(['Piernas', 'Glúteos']);
  });

  it('stays deterministic for the same brief', () => {
    const brief = strategyInput({ daysPerWeek: 4, focusAreas: ['Piernas'] });
    expect(buildDeterministicWeeklyStrategy(brief)).toEqual(buildDeterministicWeeklyStrategy(brief));
  });
});

describe('isCoherentWeeklyStrategy', () => {
  function strategy(overrides: Partial<WeeklyPlanStrategy> = {}): WeeklyPlanStrategy {
    return { source: 'gemini', days: buildDeterministicWeeklyStrategy(strategyInput()).days, restDays: [0, 4, 6], ...overrides };
  }

  it('accepts a coherent week and rejects a wrong training day count', () => {
    expect(isCoherentWeeklyStrategy(strategy(), strategyInput())).toBe(true);
    expect(isCoherentWeeklyStrategy(strategy({ days: strategy().days.slice(0, 2) }), strategyInput())).toBe(false);
  });

  it('rejects duplicate weekdays', () => {
    const days = strategy().days.map((day, index) => (index === 1 ? { ...day, dayOfWeek: 1 as const } : day));
    expect(isCoherentWeeklyStrategy(strategy({ days }), strategyInput())).toBe(false);
  });

  it('rejects a day without a resolvable focus, a focus without training days or unreachable cover', () => {
    const days = strategy().days.map((day, index) => (index === 1 ? { ...day, focus: 'Crossfit' } : day));
    expect(isCoherentWeeklyStrategy(strategy({ days }), strategyInput())).toBe(false);

    const recoveryOnly = strategy({
      days: [
        { dayOfWeek: 1, title: 'Día 1', focus: 'Movilidad y recuperación', focusAreas: [] },
        { dayOfWeek: 3, title: 'Día 2', focus: 'Movilidad y recuperación', focusAreas: [] },
        { dayOfWeek: 5, title: 'Día 3', focus: 'Movilidad y recuperación', focusAreas: [] },
      ],
    });
    expect(isCoherentWeeklyStrategy(recoveryOnly, strategyInput())).toBe(false);
  });

  it('rejects a week that does not cover a requested focus area or that stacks consecutive days', () => {
    const uncovered = strategyInput({ daysPerWeek: 2, focusAreas: ['Piernas', 'Espalda'] });
    expect(isCoherentWeeklyStrategy(buildDeterministicWeeklyStrategy(uncovered), uncovered)).toBe(true);

    const missingArea = strategy({
      days: [
        { dayOfWeek: 1, title: 'Día 1', focus: 'Piernas', focusAreas: ['Piernas'] },
        { dayOfWeek: 4, title: 'Día 2', focus: 'Piernas', focusAreas: ['Piernas'] },
      ],
    });
    expect(isCoherentWeeklyStrategy(missingArea, uncovered)).toBe(false);

    const spread = strategyInput({ daysPerWeek: 3 });
    const stacked = strategy({
      days: [
        { dayOfWeek: 1, title: 'Día 1', focus: 'Pecho', focusAreas: ['Pecho'] },
        { dayOfWeek: 2, title: 'Día 2', focus: 'Espalda', focusAreas: ['Espalda'] },
        { dayOfWeek: 3, title: 'Día 3', focus: 'Hombros', focusAreas: ['Hombros'] },
      ],
    });
    expect(isCoherentWeeklyStrategy(stacked, spread)).toBe(false);

    const fourDay = strategyInput({ daysPerWeek: 4 });
    expect(isCoherentWeeklyStrategy(buildDeterministicWeeklyStrategy(fourDay), fourDay)).toBe(true);
  });

  it('accepts coverage declared through the day focus areas instead of a single focus label', () => {
    const brief = strategyInput({ goal: 'hipertrofia', daysPerWeek: 1, focusAreas: ['Piernas', 'Pecho'] });
    const week: WeeklyPlanStrategy = {
      source: 'gemini',
      days: [
        {
          dayOfWeek: 1,
          title: 'Día 1 · Piernas y Pecho',
          focus: 'Piernas y Pecho',
          focusAreas: ['Piernas', 'Pecho'],
        },
      ],
      restDays: [0, 2, 3, 4, 5, 6],
    };

    expect(isCoherentWeeklyStrategy(week, brief)).toBe(true);
  });

  it('rejects a recovery day that is not bound to a genuine recovery group of the catalog', () => {
    const brief = strategyInput({ daysPerWeek: 6, focusAreas: ['Piernas'] });
    const withoutRecoveryGroups: RoutineDraftCatalogItem[] = catalog.filter(
      (item) => item.muscleGroup !== 'Core',
    );
    const week = buildDeterministicWeeklyStrategy(brief);
    const dishonestWeek: WeeklyPlanStrategy = {
      ...week,
      days: week.days.map((day, index) => (index === 5 ? { ...day, focusAreas: ['Piernas'] } : day)),
    };
    const honestWeek = buildDeterministicWeeklyStrategy({ ...brief, catalog: withoutRecoveryGroups });

    expect(isCoherentWeeklyStrategy(dishonestWeek, brief)).toBe(false);
    expect(honestWeek.days.filter((day) => isRecoveryFocus(day.focus))).toEqual([]);
    expect(isCoherentWeeklyStrategy(honestWeek, { ...brief, catalog: withoutRecoveryGroups })).toBe(true);
  });
});

describe('requestGeminiWeeklyStrategy', () => {
  const brief = strategyInput({ daysPerWeek: 3, focusAreas: ['Piernas'] });

  it('returns null when the Gemini key is missing', async () => {
    const fetchImpl = jest.fn<typeof fetch>();
    await expect(requestGeminiWeeklyStrategy(brief, { env: { GEMINI_API_KEY: '' }, fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('parses a coherent Gemini week and marks it as Gemini sourced', async () => {
    const fetchImpl = geminiStrategyResponse(
      weekPattern([
        { dayOfWeek: 1, focus: 'Piernas' },
        { dayOfWeek: 3, focus: 'Piernas' },
        { dayOfWeek: 5, focus: 'Piernas' },
      ]),
    );

    const strategy = await requestGeminiWeeklyStrategy(brief, {
      env: { GEMINI_API_KEY: 'test-key' },
      fetchImpl,
    });

    expect(strategy?.source).toBe('gemini');
    expect(strategy?.days.map((day) => day.dayOfWeek)).toEqual([1, 3, 5]);
    expect(strategy?.restDays).toEqual([0, 2, 4, 6]);

    const prompt = String(fetchImpl.mock.calls[0]?.[1]?.body ?? '');
    expect(prompt).toContain('weekPattern');
    expect(prompt).toContain('Piernas');
  });

  it.each([
    ['a duplicate weekday', weekPattern([
      { dayOfWeek: 1, focus: 'Piernas' },
      { dayOfWeek: 1, focus: 'Piernas' },
      { dayOfWeek: 5, focus: 'Piernas' },
    ])],
    ['a missing training day', weekPattern([
      { dayOfWeek: 1, focus: 'Piernas' },
      { dayOfWeek: 3, focus: 'Piernas' },
    ])],
    ['an unmatched focus', weekPattern([
      { dayOfWeek: 1, focus: 'Piernas' },
      { dayOfWeek: 3, focus: 'Piernas' },
      { dayOfWeek: 5, focus: 'Crossfit' },
    ])],
    ['an uncovered focus area', weekPattern([
      { dayOfWeek: 1, focus: 'Espalda' },
      { dayOfWeek: 3, focus: 'Espalda' },
      { dayOfWeek: 5, focus: 'Espalda' },
    ])],
    ['an invalid weekday', weekPattern([
      { dayOfWeek: 9, focus: 'Piernas' },
      { dayOfWeek: 3, focus: 'Piernas' },
      { dayOfWeek: 5, focus: 'Piernas' },
    ])],
    ['a malformed payload', { weekPattern: 'nope' }],
  ])('returns null for %s', async (_label, payload) => {
    const fetchImpl = geminiStrategyResponse(payload);
    await expect(
      requestGeminiWeeklyStrategy(brief, { env: { GEMINI_API_KEY: 'test-key' }, fetchImpl }),
    ).resolves.toBeNull();
  });

  it('returns null when Gemini fails, times out or answers with a non ok status', async () => {
    const failing = jest.fn<typeof fetch>().mockRejectedValue(new Error('network down'));
    const notOk = geminiStrategyResponse(weekPattern([]), false);
    const malformed = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    await expect(
      requestGeminiWeeklyStrategy(brief, { env: { GEMINI_API_KEY: 'test-key' }, fetchImpl: failing }),
    ).resolves.toBeNull();
    await expect(
      requestGeminiWeeklyStrategy(brief, { env: { GEMINI_API_KEY: 'test-key' }, fetchImpl: notOk }),
    ).resolves.toBeNull();
    await expect(
      requestGeminiWeeklyStrategy(brief, { env: { GEMINI_API_KEY: 'test-key' }, fetchImpl: malformed }),
    ).resolves.toBeNull();
  });
});

describe('resolveWeeklyStrategy', () => {
  it('uses the Gemini strategy when it is coherent', async () => {
    const fetchImpl = geminiStrategyResponse(
      weekPattern([
        { dayOfWeek: 2, focus: 'Piernas' },
        { dayOfWeek: 4, focus: 'Piernas' },
        { dayOfWeek: 6, focus: 'Piernas' },
      ]),
    );

    const strategy = await resolveWeeklyStrategy(strategyInput({ daysPerWeek: 3, focusAreas: ['Piernas'] }), {
      env: { GEMINI_API_KEY: 'test-key' },
      fetchImpl,
    });

    expect(strategy.source).toBe('gemini');
    expect(strategy.days.map((day) => day.dayOfWeek)).toEqual([2, 4, 6]);
  });

  it('recomposes deterministically when Gemini is unavailable or incoherent', async () => {
    const brief = strategyInput({ daysPerWeek: 3, focusAreas: ['Piernas'] });
    const fetchImpl = geminiStrategyResponse(weekPattern([{ dayOfWeek: 1, focus: 'Crossfit' }]));

    const incoherent = await resolveWeeklyStrategy(brief, { env: { GEMINI_API_KEY: 'test-key' }, fetchImpl });
    const disabled = await resolveWeeklyStrategy(brief, { env: { GEMINI_API_KEY: '' } });

    expect(incoherent).toEqual(buildDeterministicWeeklyStrategy(brief));
    expect(disabled).toEqual(buildDeterministicWeeklyStrategy(brief));
    expect(incoherent.source).toBe('fallback');
  });
});
