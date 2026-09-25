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
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
      textResponse({ id: 88 }, true, 201),
    ) as unknown as typeof fetch;
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
    expect(result.current.startStatus).toBe('started');
    expect(pushMock).toHaveBeenCalledWith('/dashboard/session/88');
  });

  it('applies the previewed adaptation when starting the guided session', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse(preview))
      .mockResolvedValueOnce(textResponse({ id: 91 }, true, 201));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result } = renderHook(() => useCoachAdapt({ routineId: 12 }));

    await act(async () => {
      await result.current.previewWithContext('Tengo 30 minutos');
    });
    await act(async () => {
      await result.current.startWorkout();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routineId: 12,
        adaptation: { result: preview, freeText: 'Tengo 30 minutos' },
      }),
    });
    expect(pushMock).toHaveBeenCalledWith('/dashboard/session/91');
  });

  it('keeps the original workout when starting without applying the adaptation', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse(preview))
      .mockResolvedValueOnce(textResponse({ id: 92 }, true, 201));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result } = renderHook(() => useCoachAdapt({ routineId: 12 }));

    await act(async () => {
      await result.current.previewWithContext('Tengo 30 minutos');
    });
    await act(async () => {
      await result.current.startWorkout(false);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routineId: 12 }),
    });
    expect(pushMock).toHaveBeenCalledWith('/dashboard/session/92');
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

  it('keeps the preview and reports a start conflict without navigating to another workout', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse(preview))
      .mockResolvedValueOnce(
        textResponse(
          { code: 'CONFLICT', message: 'Ya tenés un entrenamiento en curso.' },
          false,
          409,
        ),
      )
      .mockResolvedValueOnce(textResponse({ id: 44, routineId: null }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result } = renderHook(() => useCoachAdapt({ routineId: 12 }));

    await act(async () => {
      await result.current.previewWithContext('Estoy cansado');
      await result.current.startWorkout();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.step).toBe('comparacion');
    expect(result.current.result).toEqual(preview);
    expect(result.current.error).toBe('Ya tenés un entrenamiento en curso.');
    expect(result.current.startStatus).toBe('conflict');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows the server start failure and keeps the preview for retry', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse(preview))
      .mockResolvedValueOnce(
        textResponse(
          { code: 'SERVICE_UNAVAILABLE', message: 'No se pudo crear la sesión.' },
          false,
          503,
        ),
      );
    global.fetch = fetchMock as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result } = renderHook(() => useCoachAdapt({ routineId: 12 }));

    await act(async () => {
      await result.current.previewWithContext('Estoy cansado');
      await result.current.startWorkout();
    });

    expect(result.current.step).toBe('comparacion');
    expect(result.current.result).toEqual(preview);
    expect(result.current.error).toBe('No se pudo crear la sesión.');
    expect(result.current.startStatus).toBe('error');
    expect(pushMock).not.toHaveBeenCalled();
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
      resolveStart(textResponse({ id: 99 }, true, 201));
    });

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard/session/99'));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
