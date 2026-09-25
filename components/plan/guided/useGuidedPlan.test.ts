/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useGuidedPlan } from './useGuidedPlan';
import type { WeeklyPlanDraft } from '@/lib/ai/weekly-plan-draft';
import type { ExerciseCatalogItem } from '@/types/exercise';

const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function exercise(id: number, name: string, muscleGroup: string): ExerciseCatalogItem {
  return {
    id,
    slug: name.toLowerCase(),
    name,
    muscleGroup,
    instructions: `Hacé ${name}.`,
    imageUrl: null,
    videoUrl: null,
    isSystem: true,
  };
}

const catalog = [
  exercise(1, 'Press banca', 'Pecho'),
  exercise(2, 'Remo', 'Espalda'),
  exercise(3, 'Sentadilla', 'Piernas'),
  exercise(4, 'Plancha', 'Core'),
  exercise(5, 'Press militar', 'Hombros'),
  exercise(6, 'Peso muerto rumano', 'Isquios'),
];

function generatedPlan(goal: string, daysPerWeek: number): WeeklyPlanDraft {
  const weekdays = [[1], [1, 4], [1, 3, 5], [1, 2, 4, 5], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6]][daysPerWeek - 1] ?? [1, 3, 5];
  return {
    source: 'fallback',
    name: `Coach Atlas · ${goal}`,
    goal,
    days: weekdays.map((dayOfWeek, index) => ({
      dayOfWeek: dayOfWeek as WeeklyPlanDraft['days'][number]['dayOfWeek'],
      title: `Día ${index + 1}`,
      focus: `Foco ${index + 1}`,
      exercises: [{
        exerciseId: index + 1,
        exerciseName: `Ejercicio ${index + 1}`,
        muscleGroup: 'Fuerza',
        sortOrder: 0,
        targetSets: 3,
        targetReps: 8,
      }],
    })),
  };
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe('useGuidedPlan', () => {
  it('saves all routines and the weekly plan with one explicit request', async () => {
    const onSaved = jest.fn();
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(generatedPlan('hipertrofia con técnica', 3)))
      .mockResolvedValueOnce(jsonResponse({ plan: { id: 55 }, schedule: [] }));
    global.fetch = fetchMock;
    const { result } = renderHook(() => useGuidedPlan({ catalog, onSaved }));

    await act(async () => {
      result.current.updateField('goal', '  hipertrofia con técnica  ');
      result.current.updateField('daysPerWeek', '3');
      await result.current.generateDraft();
    });

    expect(result.current.step).toBe('review');
    expect(result.current.draft?.days).toHaveLength(3);

    await act(async () => {
      await result.current.confirmDraft();
    });

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('/dashboard/today'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/training-plan/generate');
    const generationPayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(generationPayload).toEqual({
      goal: '  hipertrofia con técnica  ',
      daysPerWeek: 3,
      experience: 'intermediate',
      availableEquipment: ['gimnasio completo'],
      sessionLengthMinutes: 55,
      focusAreas: [],
    });
    expect(generationPayload).not.toHaveProperty('catalog');
    expect(generationPayload).not.toHaveProperty('apiKey');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/training-plan/guided');
    const savePayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      mutationId: string;
      name: string;
      goal: string;
      days: Array<{
        dayOfWeek: number;
        routine: { name: string; exercises: unknown[] };
      }>;
    };
    expect(savePayload.mutationId).toEqual(expect.any(String));
    expect(savePayload).toMatchObject({
      name: 'Coach Atlas · hipertrofia con técnica',
      goal: 'hipertrofia con técnica',
      days: [
        { dayOfWeek: 1, routine: { name: expect.stringContaining('Día 1') } },
        { dayOfWeek: 3, routine: { name: expect.stringContaining('Día 2') } },
        { dayOfWeek: 5, routine: { name: expect.stringContaining('Día 3') } },
      ],
    });
    expect(savePayload.days.every(({ routine }) => routine.exercises.length > 0)).toBe(true);
  });

  it('surfaces a typed save error without issuing separate routine requests', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(generatedPlan('fuerza', 3)))
      .mockResolvedValueOnce(jsonResponse({ message: 'Rutina inválida' }, 400));
    global.fetch = fetchMock;
    const { result } = renderHook(() => useGuidedPlan({ catalog }));

    await act(async () => {
      result.current.updateField('goal', 'fuerza');
      await result.current.generateDraft();
      await result.current.confirmDraft();
    });

    expect(result.current.error).toEqual({
      kind: 'plan_create',
      message: 'Rutina inválida',
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/training-plan/guided');
    expect(result.current.saving).toBe(false);
  });

  it('retries a failed save with the same mutation ID and payload without deleting routines', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(generatedPlan('fuerza', 2)))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse({ plan: { id: 55 }, schedule: [] }));
    global.fetch = fetchMock;
    const { result } = renderHook(() => useGuidedPlan({ catalog }));

    await act(async () => {
      result.current.updateField('goal', 'fuerza');
      result.current.updateField('daysPerWeek', '2');
      await result.current.generateDraft();
      await result.current.confirmDraft();
      await result.current.confirmDraft();
    });

    expect(result.current.step).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const firstSave = fetchMock.mock.calls[1];
    const retrySave = fetchMock.mock.calls[2];
    expect(firstSave?.[0]).toBe('/api/training-plan/guided');
    expect(retrySave?.[0]).toBe('/api/training-plan/guided');
    expect(retrySave?.[1]?.body).toBe(firstSave?.[1]?.body);
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes('/api/routines/') || init?.method === 'DELETE')).toBe(false);
  });

  it('does not persist the same accepted draft twice after success', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(generatedPlan('fuerza', 1)))
      .mockResolvedValue(jsonResponse({ id: 101 }));
    global.fetch = fetchMock;
    const { result } = renderHook(() => useGuidedPlan({ catalog }));

    await act(async () => {
      result.current.updateField('goal', 'fuerza');
      result.current.updateField('daysPerWeek', '1');
      await result.current.generateDraft();
      await result.current.confirmDraft();
      await result.current.confirmDraft();
    });

    expect(result.current.step).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps draft generation non-persistent until the explicit save action', async () => {
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(generatedPlan('fuerza', 3)));
    global.fetch = fetchMock;
    const { result } = renderHook(() => useGuidedPlan({ catalog }));

    await act(async () => {
      result.current.updateField('goal', 'fuerza');
      await result.current.generateDraft();
    });

    expect(result.current.step).toBe('review');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/training-plan/generate', expect.any(Object));
  });

  it('refuses a generated response with duplicate weekdays before showing review', async () => {
    const invalidDraft = generatedPlan('fuerza', 2);
    invalidDraft.days[1] = { ...invalidDraft.days[1]!, dayOfWeek: invalidDraft.days[0]!.dayOfWeek };
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(invalidDraft));
    global.fetch = fetchMock;
    const { result } = renderHook(() => useGuidedPlan({ catalog }));

    await act(async () => {
      result.current.updateField('goal', 'fuerza');
      result.current.updateField('daysPerWeek', '2');
      await result.current.generateDraft();
    });

    expect(result.current.step).toBe('brief');
    expect(result.current.draft).toBeNull();
    expect(result.current.error).toMatchObject({ kind: 'generate' });
  });

  it('bounds the saved schedule note when normalized title and focus reach their limits', async () => {
    const longDraft = generatedPlan('fuerza', 1);
    longDraft.days[0] = {
      ...longDraft.days[0]!,
      title: 't'.repeat(60),
      focus: 'f'.repeat(80),
    };
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(longDraft))
      .mockResolvedValueOnce(jsonResponse({ plan: { id: 55 }, schedule: [] }));
    global.fetch = fetchMock;
    const { result } = renderHook(() => useGuidedPlan({ catalog }));

    await act(async () => {
      result.current.updateField('goal', 'fuerza');
      result.current.updateField('daysPerWeek', '1');
      await result.current.generateDraft();
      await result.current.confirmDraft();
    });

    const savedPlan = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      days: Array<{ note: string }>;
    };
    expect(savedPlan.days[0]?.note).toHaveLength(140);
    expect(savedPlan.days[0]?.note).toBe(`${'t'.repeat(60)} · ${'f'.repeat(77)}`);
  });
});
