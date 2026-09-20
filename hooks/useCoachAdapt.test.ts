/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { CoachAdaptationResult } from '@/types/coach';

const pushMock = jest.fn<(href: string) => void>();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const preview: CoachAdaptationResult = {
  original: { exerciseCount: 5, setCount: 16, estMinutes: 55 },
  adapted: { exerciseCount: 4, setCount: 11, estMinutes: 32 },
  exerciseDeltas: [
    { exerciseId: 1, name: 'Press banca', action: 'reduced', fromSets: 4, toSets: 2 },
    { exerciseId: 2, name: 'Curl bíceps', action: 'removed', fromSets: 3, toSets: 0 },
  ],
  reason: 'Bajamos volumen porque registraste energía baja.',
  source: 'ai',
};

function textResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('useCoachAdapt', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    pushMock.mockClear();
  });

  it('previews adaptation with today check-in and advances to comparison', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(textResponse(preview));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result } = renderHook(() => useCoachAdapt({ routineId: 12 }));

    await act(async () => {
      await result.current.previewWithContext('Tengo 30 minutos');
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/coach/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routineId: 12, freeText: 'Tengo 30 minutos' }),
    });
    expect(result.current.step).toBe('comparacion');
    expect(result.current.result).toEqual(preview);
    expect(result.current.error).toBeNull();
  });

  it('shows a check-in validation error without fabricating energy or mood', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(textResponse(
      { code: 'VALIDATION', message: 'Necesitás registrar tu check-in de hoy antes de adaptar.' },
      false,
      400,
    ));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result } = renderHook(() => useCoachAdapt({ routineId: 12 }));

    await act(async () => {
      await result.current.previewWithContext('');
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/coach/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routineId: 12 }),
    });
    expect(result.current.step).toBe('motivo');
    expect(result.current.error).toBe('Necesitás registrar tu check-in de hoy antes de adaptar.');
    expect(result.current.result).toBeNull();
  });

  it('starts the workout, marks confirmado, and navigates to the guided session', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(textResponse({ id: 88 })) as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result } = renderHook(() => useCoachAdapt({ routineId: 12 }));

    await act(async () => {
      await result.current.startWorkout();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routineId: 12 }),
    });
    expect(result.current.step).toBe('confirmado');
    expect(pushMock).toHaveBeenCalledWith('/dashboard/session/88');
  });

  it('resets comparison state when adjusting another thing', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(textResponse(preview)) as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result } = renderHook(() => useCoachAdapt({ routineId: 12 }));

    await act(async () => {
      await result.current.previewWithContext('Estoy cansado');
    });
    act(() => {
      result.current.adjustAgain();
    });

    expect(result.current.step).toBe('motivo');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('continues an active free workout on start conflict using the free-workout route', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse({ code: 'CONFLICT', message: 'Ya tienes un entrenamiento en curso' }, false, 409))
      .mockResolvedValueOnce(textResponse({ id: 44, routineId: null }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result } = renderHook(() => useCoachAdapt({ routineId: 12 }));

    await act(async () => {
      await result.current.startWorkout();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/workouts/active');
    expect(pushMock).toHaveBeenCalledWith('/dashboard/workout/44');
  });

  it('guards against double start submit while a request is in flight', async () => {
    let resolveStart: (response: Response) => void = () => undefined;
    global.fetch = jest.fn<typeof fetch>().mockImplementation(
      () => new Promise<Response>((resolve) => { resolveStart = resolve; }),
    ) as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result } = renderHook(() => useCoachAdapt({ routineId: 12 }));

    void act(() => {
      void result.current.startWorkout();
    });
    await waitFor(() => expect(result.current.starting).toBe(true));

    await act(async () => {
      await result.current.startWorkout();
      resolveStart(textResponse({ id: 99 }));
    });

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard/session/99'));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
