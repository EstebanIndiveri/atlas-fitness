/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useGuidedPlan } from './useGuidedPlan';
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

afterEach(() => {
  global.fetch = originalFetch;
});

describe('useGuidedPlan', () => {
  it('creates each routine first and then creates the training plan schedule', async () => {
    const onSaved = jest.fn();
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ id: 101 }))
      .mockResolvedValueOnce(jsonResponse({ id: 102 }))
      .mockResolvedValueOnce(jsonResponse({ id: 103 }))
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
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.slice(0, 3).map((call) => call[0])).toEqual([
      '/api/routines',
      '/api/routines',
      '/api/routines',
    ]);
    expect(fetchMock.mock.calls[3]?.[0]).toBe('/api/training-plan');
    const firstRoutinePayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      name: string;
      exercises: unknown[];
    };
    expect(firstRoutinePayload.name).toContain('Día 1');
    expect(firstRoutinePayload.exercises.length).toBeGreaterThan(0);
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toMatchObject({
      name: 'Coach Atlas · hipertrofia con técnica',
      goal: 'hipertrofia con técnica',
      schedule: [
        { dayOfWeek: 1, routineId: 101 },
        { dayOfWeek: 3, routineId: 102 },
        { dayOfWeek: 5, routineId: 103 },
      ],
    });
  });

  it('surfaces a typed routine creation error and does not create the plan', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ message: 'Rutina inválida' }, 400));
    global.fetch = fetchMock;
    const { result } = renderHook(() => useGuidedPlan({ catalog }));

    await act(async () => {
      result.current.updateField('goal', 'fuerza');
      await result.current.generateDraft();
      await result.current.confirmDraft();
    });

    expect(result.current.error).toEqual({
      kind: 'routine_create',
      message: 'Rutina inválida',
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(false);
  });

  it('deletes created routines when the final plan creation fails', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ id: 101 }))
      .mockResolvedValueOnce(jsonResponse({ id: 102 }))
      .mockResolvedValueOnce(jsonResponse({ message: 'Goal inválido' }, 400))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ success: true }));
    global.fetch = fetchMock;
    const { result } = renderHook(() => useGuidedPlan({ catalog }));

    await act(async () => {
      result.current.updateField('goal', 'fuerza');
      result.current.updateField('daysPerWeek', '2');
      await result.current.generateDraft();
      await result.current.confirmDraft();
    });

    expect(result.current.error).toEqual({
      kind: 'plan_create',
      message: 'Goal inválido',
      status: 400,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/routines/101', { method: 'DELETE' });
    expect(fetchMock).toHaveBeenNthCalledWith(5, '/api/routines/102', { method: 'DELETE' });
  });

  it('does not persist the same accepted draft twice after success', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
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
});
