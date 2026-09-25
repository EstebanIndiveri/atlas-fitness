import { describe, expect, it, jest } from '@jest/globals';

import { generateWeeklyPlanDraft } from './weekly-plan-draft';
import type { WeeklyPlanDraftInput } from './weekly-plan-draft';
import type { ExerciseCatalogItem } from '@/types/exercise';

function exercise(id: number, name: string, muscleGroup: string): ExerciseCatalogItem {
  return {
    id,
    slug: name.toLowerCase().replaceAll(' ', '-'),
    name,
    muscleGroup,
    instructions: `Hacé ${name} con técnica controlada.`,
    imageUrl: null,
    videoUrl: null,
    isSystem: true,
  };
}

const catalog: ExerciseCatalogItem[] = [
  exercise(1, 'Press banca', 'Pecho'),
  exercise(2, 'Remo con barra', 'Espalda'),
  exercise(3, 'Sentadilla', 'Piernas'),
  exercise(4, 'Press militar', 'Hombros'),
  exercise(5, 'Peso muerto rumano', 'Isquios'),
  exercise(6, 'Curl bíceps', 'Bíceps'),
  exercise(7, 'Plancha', 'Core'),
  exercise(8, 'Zancadas', 'Glúteos'),
];

function input(daysPerWeek: number, overrides: Partial<WeeklyPlanDraftInput> = {}): WeeklyPlanDraftInput {
  return {
    goal: 'ganar fuerza sin perder movilidad',
    daysPerWeek,
    experience: 'intermediate',
    availableEquipment: ['gimnasio completo'],
    sessionLengthMinutes: 55,
    focusAreas: ['pecho', 'espalda', 'piernas'],
    catalog,
    ...overrides,
  };
}

function geminiResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

describe('generateWeeklyPlanDraft', () => {
  it('uses the deterministic fallback unchanged when Gemini key is missing', async () => {
    const draft = await generateWeeklyPlanDraft(input(3), { env: { GEMINI_API_KEY: '' } });

    expect(draft).toMatchObject({
      source: 'fallback',
      name: 'Coach Atlas · ganar fuerza sin perder movilidad',
      goal: 'ganar fuerza sin perder movilidad',
    });
    expect(draft.days.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      title: day.title,
      focus: day.focus,
      exerciseIds: day.exercises.map((exerciseItem) => exerciseItem.exerciseId),
    }))).toEqual([
      { dayOfWeek: 1, title: 'Día 1', focus: 'Empuje · pecho', exerciseIds: [1, 2] },
      { dayOfWeek: 3, title: 'Día 2', focus: 'Tirón · espalda', exerciseIds: [2, 1] },
      { dayOfWeek: 5, title: 'Día 3', focus: 'Piernas', exerciseIds: [3, 1] },
    ]);
  });

  it('returns a Gemini weekly plan when the response is valid', async () => {
    const fetchImpl = jest.fn(async () => geminiResponse({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              name: 'Semana fuerza Atlas',
              goal: 'fuerza progresiva',
              days: [
                {
                  dayOfWeek: 2,
                  title: 'Torso fuerte',
                  focus: 'Pecho y espalda',
                  exercises: [
                    { exerciseId: 1, targetSets: 3, targetReps: 8 },
                    { exerciseId: 2, targetSets: 3, targetReps: 10 },
                  ],
                },
                {
                  dayOfWeek: 4,
                  title: 'Piernas sólidas',
                  focus: 'Piernas',
                  exercises: [
                    { exerciseId: 3, targetSets: 4, targetReps: 6 },
                  ],
                },
              ],
            }),
          }],
        },
      }],
    }));

    const draft = await generateWeeklyPlanDraft(input(2), {
      env: { GEMINI_API_KEY: 'test-key' },
      fetchImpl,
    });

    expect(draft.source).toBe('gemini');
    expect(draft.name).toBe('Semana fuerza Atlas');
    expect(draft.goal).toBe(input(2).goal);
    expect(draft.days).toHaveLength(2);
    expect(draft.days[0]).toMatchObject({
      dayOfWeek: 2,
      title: 'Torso fuerte',
      focus: 'Pecho y espalda',
    });
    expect(draft.days[0]?.exercises.map((exerciseItem) => exerciseItem.exerciseId)).toEqual([1, 2]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('falls back when Gemini returns malformed or invalid content', async () => {
    const malformedFetch = jest.fn(async () => geminiResponse({
      candidates: [{ content: { parts: [{ text: '{"days":[]}' }] } }],
    }));

    const draft = await generateWeeklyPlanDraft(input(3), {
      env: { GEMINI_API_KEY: 'test-key' },
      fetchImpl: malformedFetch,
    });

    expect(draft.source).toBe('fallback');
    expect(draft.days).toHaveLength(3);
    expect(draft.days[0]?.focus).toBe('Empuje · pecho');
  });

  it('falls back when Gemini times out or the network fails', async () => {
    const failingFetch = jest.fn(async () => {
      throw new Error('network down');
    });

    const draft = await generateWeeklyPlanDraft(input(3), {
      env: { GEMINI_API_KEY: 'test-key' },
      fetchImpl: failingFetch,
      timeoutMs: 1,
    });

    expect(draft.source).toBe('fallback');
    expect(draft.days.map((day) => day.dayOfWeek)).toEqual([1, 3, 5]);
  });

  it('rejects a Gemini proposal with an invalid weekday', async () => {
    const fetchImpl = jest.fn(async () => geminiResponse({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              name: 'Semana validada',
              goal: 'fuerza',
              days: [{
                dayOfWeek: 9,
                title: '  Día con catálogo  ',
                focus: '  Piernas  ',
                exercises: [
                  { exerciseId: 999, targetSets: 99, targetReps: 99 },
                  { exerciseId: 3, targetSets: 99, targetReps: 0 },
                  { exerciseId: 3, targetSets: 2, targetReps: 12 },
                ],
              }],
            }),
          }],
        },
      }],
    }));

    const draft = await generateWeeklyPlanDraft(input(1), {
      env: { GEMINI_API_KEY: 'test-key' },
      fetchImpl,
    });

    expect(draft.source).toBe('fallback');
    expect(draft.days).toHaveLength(1);
    expect(draft.days[0]?.dayOfWeek).toBe(1);

  });

  it('falls back when Gemini assigns duplicate weekdays', async () => {
    const fetchImpl = jest.fn(async () => geminiResponse({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              name: 'Semana con días repetidos',
              goal: 'fuerza',
              days: [2, 2].map((dayOfWeek) => ({
                dayOfWeek,
                title: 'Día de fuerza',
                focus: 'Fuerza',
                exercises: [{ exerciseId: 3, targetSets: 3, targetReps: 8 }],
              })),
            }),
          }],
        },
      }],
    }));

    const draft = await generateWeeklyPlanDraft(input(2), {
      env: { GEMINI_API_KEY: 'test-key' },
      fetchImpl,
    });

    expect(draft.source).toBe('fallback');
    expect(draft.days.map((day) => day.dayOfWeek)).toEqual([1, 4]);
    expect(new Set(draft.days.map((day) => day.dayOfWeek)).size).toBe(draft.days.length);
  });

  it('resolves Gemini exercises through the catalog and clamps training targets', async () => {
    const fetchImpl = jest.fn(async () => geminiResponse({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              name: 'Semana validada',
              goal: 'fuerza',
              days: [{
                dayOfWeek: 2,
                title: '  Día con catálogo  ',
                focus: '  Piernas  ',
                exercises: [
                  { exerciseId: 999, targetSets: 99, targetReps: 99 },
                  { exerciseId: 3, targetSets: 99, targetReps: 0 },
                  { exerciseId: 3, targetSets: 2, targetReps: 12 },
                ],
              }],
            }),
          }],
        },
      }],
    }));

    const draft = await generateWeeklyPlanDraft(input(1), {
      env: { GEMINI_API_KEY: 'test-key' },
      fetchImpl,
    });

    expect(draft.source).toBe('gemini');
    expect(draft.days).toHaveLength(1);
    expect(draft.days[0]?.dayOfWeek).toBe(2);
    expect(draft.days[0]?.exercises).toEqual([
      expect.objectContaining({
        exerciseId: 3,
        exerciseName: 'Sentadilla',
        muscleGroup: 'Piernas',
        sortOrder: 0,
        targetSets: 8,
        targetReps: 1,
      }),
    ]);
  });

  it.each([3, 4, 5])(
    'returns %i deterministic days with distinct focuses and non-empty exercises',
    async (daysPerWeek) => {
      const first = await generateWeeklyPlanDraft(input(daysPerWeek));
      const second = await generateWeeklyPlanDraft(input(daysPerWeek));

      expect(first).toEqual(second);
      expect(first.days).toHaveLength(daysPerWeek);
      expect(new Set(first.days.map((day) => day.focus)).size).toBe(daysPerWeek);
      expect(first.days.every((day) => day.exercises.length > 0)).toBe(true);
      expect(first.goal).toBe('ganar fuerza sin perder movilidad');
      expect(first.name).toContain('Coach Atlas');
    },
  );

  it('keeps the minimum of one training day', async () => {
    const draft = await generateWeeklyPlanDraft(input(0));

    expect(draft.days).toHaveLength(1);
    expect(draft.days[0]?.dayOfWeek).toBe(1);
  });

  it('clamps large plans to six days', async () => {
    const draft = await generateWeeklyPlanDraft(input(9));

    expect(draft.days).toHaveLength(7);
    expect(draft.days.map((day) => day.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it('includes the full current-plan snapshot in the Gemini improvement prompt', async () => {
    const currentPlan = {
      name: 'Semana base',
      goal: 'fuerza',
      days: [
        {
          dayOfWeek: 2 as const,
          kind: 'routine' as const,
          routineName: 'Rutina de torso',
          focus: 'Técnica',
          exercises: [{ exerciseId: 1, exerciseName: 'Press banca', targetSets: 4, targetReps: 6 }],
        },
      ],
    };
    const fetchImpl = jest.fn<typeof fetch>(async (_input, _init) =>
      geminiResponse({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                name: 'Semana mejorada',
                goal: 'ganar fuerza sin perder movilidad',
                days: [{
                  dayOfWeek: 2,
                  title: 'Día de torso',
                  focus: 'Fuerza técnica',
                  exercises: [{ exerciseId: 1, targetSets: 3, targetReps: 8 }],
                }],
              }),
            }],
          },
        }],
      }),
    );

    const draft = await generateWeeklyPlanDraft(input(1, { currentPlan }), {
      env: { GEMINI_API_KEY: 'test-key' },
      fetchImpl,
    });

    expect(draft.source).toBe('gemini');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const requestBody = fetchImpl.mock.calls[0]?.[1]?.body;
    expect(requestBody).toContain('Estás proponiendo una mejora para un plan semanal existente.');
    expect(requestBody).toContain('Semana base');
    expect(requestBody).toContain('Rutina de torso');
  });

  it('uses an honest fallback goal when the user goal is blank', async () => {
    const draft = await generateWeeklyPlanDraft(input(3, { goal: '   ' }));

    expect(draft.goal).toBe('mejorar condición general');
    expect(draft.name).toContain('condición general');
  });

  it('caps long goals to the server limit before persistence', async () => {
    const longGoal = 'ganar fuerza manteniendo movilidad y cuidando rodillas con sesiones progresivas';
    const draft = await generateWeeklyPlanDraft(input(3, { goal: longGoal }));

    expect(draft.goal).toHaveLength(60);
    expect(draft.goal).toBe(longGoal.slice(0, 60).trim());
  });

  it('throws when the catalog is empty', async () => {
    await expect(generateWeeklyPlanDraft(input(3, { catalog: [] }))).rejects.toThrow(
      'No hay ejercicios disponibles para armar un plan semanal.',
    );
  });
});
