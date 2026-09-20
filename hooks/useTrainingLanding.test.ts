/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import { UI_COPY } from '@/lib/copy/ui';

const pushMock = jest.fn<(href: string) => void>();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

function textResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

function routine(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 12,
    slug: 'torso',
    name: 'Torso',
    description: null,
    kind: 'gym',
    restSeconds: 90,
    isSystem: false,
    exercises: [
      {
        id: 1,
        routineId: 12,
        exerciseId: 101,
        sortOrder: 0,
        targetSets: 4,
        targetReps: 8,
        exerciseName: 'Press banca',
        muscleGroup: 'Pecho',
        instructions: 'Controlado.',
        imageUrl: null,
        videoUrl: null,
      },
    ],
    ...overrides,
  };
}

describe('useTrainingLanding', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    pushMock.mockClear();
  });

  it('loads today, routines, and active workout on mount', async () => {
    const { useTrainingLanding } = await import('./useTrainingLanding');
    const today = {
      kind: 'workout',
      localDate: '2026-09-20',
      dayOfWeek: 0,
      trainingPlanId: 1,
      scheduledRoutineId: 2,
      routineId: 12,
      routineName: 'Torso',
      planGoal: 'Fuerza',
      dayReason: null,
      completion: { completed: 0, total: 1 },
    } as const;
    const activeWorkout = { id: 77, routineId: 12 };
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse(today))
      .mockResolvedValueOnce(textResponse([routine()]))
      .mockResolvedValueOnce(textResponse(activeWorkout));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useTrainingLanding());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/today');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/routines');
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/workouts/active');
    expect(result.current.today).toEqual(today);
    expect(result.current.routines).toEqual([routine()]);
    expect(result.current.activeWorkout?.id).toBe(77);
    expect(result.current.error).toBeNull();
  });

  it('starts a workout and navigates to the guided session', async () => {
    const { useTrainingLanding } = await import('./useTrainingLanding');
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse({ kind: 'no_plan', localDate: '2026-09-20', dayOfWeek: 0 }))
      .mockResolvedValueOnce(textResponse([routine()]))
      .mockResolvedValueOnce(textResponse(null))
      .mockResolvedValueOnce(textResponse({ id: 88 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useTrainingLanding());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.start(12);
    });

    expect(fetchMock).toHaveBeenLastCalledWith('/api/workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routineId: 12 }),
    });
    expect(pushMock).toHaveBeenCalledWith('/dashboard/session/88');
    expect(result.current.starting).toBeNull();
  });

  it('drops malformed routines instead of rendering dishonest counts', async () => {
    const { useTrainingLanding } = await import('./useTrainingLanding');
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse({ kind: 'no_plan', localDate: '2026-09-20', dayOfWeek: 0 }))
      .mockResolvedValueOnce(textResponse([routine(), routine({ id: 'bad' })]))
      .mockResolvedValueOnce(textResponse(null));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useTrainingLanding());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.routines).toHaveLength(1);
    expect(result.current.routines[0]?.id).toBe(12);
    expect(result.current.error).toBeNull();
  });

  it('reports load errors and invalid start responses', async () => {
    const { useTrainingLanding } = await import('./useTrainingLanding');
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse({ kind: 'no_plan', localDate: '2026-09-20', dayOfWeek: 0 }))
      .mockResolvedValueOnce(textResponse([routine()]))
      .mockResolvedValueOnce(textResponse(null))
      .mockResolvedValueOnce(textResponse({ id: 'bad' }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useTrainingLanding());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.start(12);
    });

    expect(result.current.error).toBe(UI_COPY.training.errorLoad);
    expect(pushMock).not.toHaveBeenCalled();
    expect(result.current.starting).toBeNull();
  });
});
