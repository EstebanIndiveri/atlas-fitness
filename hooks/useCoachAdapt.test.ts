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

type CheckInContext = {
  dailyCheckInId: number;
  mood: 1 | 2 | 3 | 4 | 5;
  energy: 'low' | 'medium' | 'high';
};

type TestCoachAdaptInput = {
  routineId: number | null;
  checkInContext: CheckInContext | null;
};

const completeCheckIn: CheckInContext = { dailyCheckInId: 17, mood: 4, energy: 'high' };

function coachAdaptInput(
  routineId: number | null,
  checkInContext: CheckInContext | null = completeCheckIn,
): TestCoachAdaptInput {
  return { routineId, checkInContext };
}

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
    const { result } = renderHook(() => useCoachAdapt(coachAdaptInput(12)));

    await act(async () => {
      await result.current.previewWithContext('Tengo 30 minutos');
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/coach/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routineId: 12,
        energy: 'high',
        mood: 4,
        freeText: 'Tengo 30 minutos',
      }),
    });
    expect(result.current.step).toBe('comparacion');
    expect(result.current.result).toEqual(preview);
    expect(result.current.error).toBeNull();
  });

  it('does not call the preview service without user-provided mood and energy', async () => {
    const fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result } = renderHook(() => useCoachAdapt(coachAdaptInput(12, null)));

    await act(async () => {
      await result.current.previewWithContext('Tengo 30 minutos');
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBe('Registrá tu ánimo y energía antes de preparar una vista previa.');
  });

  it('shows a check-in validation error without fabricating energy or mood', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(textResponse(
      { code: 'VALIDATION', message: 'Necesitás registrar tu check-in de hoy antes de adaptar.' },
      false,
      400,
    ));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result } = renderHook(() => useCoachAdapt(coachAdaptInput(12)));

    await act(async () => {
      await result.current.previewWithContext('');
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/coach/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routineId: 12, energy: 'high', mood: 4 }),
    });
    expect(result.current.step).toBe('motivo');
    expect(result.current.error).toBe('Necesitás registrar tu check-in de hoy antes de adaptar.');
    expect(result.current.result).toBeNull();
  });

  it('starts the original workout only when explicitly requested', async () => {
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
      textResponse({ id: 88 }, true, 201),
    ) as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result } = renderHook(() => useCoachAdapt(coachAdaptInput(12)));

    await act(async () => {
      await result.current.startWorkout(false);
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

  it('requires a current preview before starting an adapted workout', async () => {
    const fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result } = renderHook(() => useCoachAdapt(coachAdaptInput(12)));

    await act(async () => {
      await result.current.startWorkout(true);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.startStatus).toBe('error');
    expect(result.current.error).toBe('Prepará una vista previa antes de iniciar el entrenamiento adaptado.');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('applies the previewed adaptation when starting the guided session', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse(preview))
      .mockResolvedValueOnce(textResponse({ id: 91 }, true, 201));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result } = renderHook(() => useCoachAdapt(coachAdaptInput(12)));

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
        adaptation: {
          result: preview,
          freeText: 'Tengo 30 minutos',
          dailyCheckInId: 17,
          checkInContext: { mood: 4, energy: 'high' },
        },
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
    const { result } = renderHook(() => useCoachAdapt(coachAdaptInput(12)));

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
    const { result } = renderHook(() => useCoachAdapt(coachAdaptInput(12)));

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

  it('refuses to start a stale preview when the source routine changes', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse(preview))
      .mockResolvedValueOnce(textResponse({ id: 93 }, true, 201));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result, rerender } = renderHook(
      ({ routineId }: { routineId: number | null }) => useCoachAdapt(coachAdaptInput(routineId)),
      { initialProps: { routineId: 12 } },
    );

    await act(async () => {
      await result.current.previewWithContext('Estoy cansado');
    });
    rerender({ routineId: 13 });

    expect(result.current.result).toBeNull();
    await act(async () => {
      await result.current.startWorkout();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.startStatus).toBe('error');
    expect(result.current.error).toBe(
      'La rutina o el check-in cambió. Prepará una nueva vista previa antes de iniciar.',
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('invalidates a preview when the user changes mood or energy', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse(preview));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const initialProps: { checkInContext: CheckInContext | null } = {
      checkInContext: completeCheckIn,
    };
    const { result, rerender } = renderHook(
      ({ checkInContext }: { checkInContext: CheckInContext | null }) =>
        useCoachAdapt(coachAdaptInput(12, checkInContext)),
      { initialProps },
    );

    await act(async () => {
      await result.current.previewWithContext('Estoy cansado');
    });
    rerender({ checkInContext: { dailyCheckInId: 17, mood: 1, energy: 'low' } });

    expect(result.current.result).toBeNull();
    await act(async () => {
      await result.current.startWorkout(true);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.startStatus).toBe('error');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('invalidates a preview when its persisted check-in source changes', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse(preview));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const { result, rerender } = renderHook(
      ({ checkInContext }: { checkInContext: CheckInContext | null }) =>
        useCoachAdapt(coachAdaptInput(12, checkInContext)),
      { initialProps: { checkInContext: completeCheckIn } },
    );

    await act(async () => {
      await result.current.previewWithContext('Estoy cansado');
    });
    rerender({
      checkInContext: { ...completeCheckIn, dailyCheckInId: 18 },
    });

    expect(result.current.result).toBeNull();
    await act(async () => {
      await result.current.startWorkout(true);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.startStatus).toBe('error');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('discards an in-flight preview when check-in context becomes incomplete and then changes', async () => {
    let resolvePreview: (response: Response) => void = () => undefined;
    const fetchMock = jest.fn<typeof fetch>().mockImplementation(
      () => new Promise<Response>((resolve) => { resolvePreview = resolve; }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const { useCoachAdapt } = await import('./useCoachAdapt');
    const initialProps: { checkInContext: CheckInContext | null } = {
      checkInContext: completeCheckIn,
    };
    const { result, rerender } = renderHook(
      ({ checkInContext }: { checkInContext: CheckInContext | null }) =>
        useCoachAdapt(coachAdaptInput(12, checkInContext)),
      { initialProps },
    );
    let previewPromise: Promise<CoachAdaptationResult | null> | undefined;

    await act(async () => {
      previewPromise = result.current.previewWithContext('Estoy cansado');
    });
    rerender({ checkInContext: null });
    rerender({ checkInContext: { dailyCheckInId: 17, mood: 1, energy: 'low' } });
    await act(async () => {
      resolvePreview(textResponse(preview));
      await previewPromise;
    });

    expect(result.current.result).toBeNull();
    expect(result.current.step).toBe('motivo');
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
    const { result } = renderHook(() => useCoachAdapt(coachAdaptInput(12)));

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
    const { result } = renderHook(() => useCoachAdapt(coachAdaptInput(12)));

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
    const { result } = renderHook(() => useCoachAdapt(coachAdaptInput(12)));

    void act(() => {
      void result.current.startWorkout(false);
    });
    await waitFor(() => expect(result.current.starting).toBe(true));

    await act(async () => {
      await result.current.startWorkout(false);
      resolveStart(textResponse({ id: 99 }, true, 201));
    });

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard/session/99'));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
