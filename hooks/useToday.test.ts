import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import { TODAY_COPY } from '@/lib/copy/today';

import { useToday } from './useToday';

function jsonTextResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('useToday', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads today workout data on mount', async () => {
    const today = {
      kind: 'workout',
      localDate: '2026-09-19',
      dayOfWeek: 6,
      trainingPlanId: 10,
      scheduledRoutineId: 20,
      routineId: 30,
      routineName: 'Torso pesado',
      planGoal: null,
    } as const;
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(jsonTextResponse(today));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useToday());
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/today');
    expect(result.current.today).toEqual(today);
    expect(result.current.error).toBeNull();
  });

  it('maps unauthorized load errors to the session expired copy', async () => {
    global.fetch = jest.fn(async () =>
      jsonTextResponse({ code: 'UNAUTHORIZED', message: 'Autenticación requerida' }, false, 401),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useToday());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.today).toBeNull();
    expect(result.current.error).toBe(TODAY_COPY.todaySessionExpired);
  });

  it('maps generic load errors to the generic today copy', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useToday());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.today).toBeNull();
    expect(result.current.error).toBe(TODAY_COPY.todayError);
  });

  it('reloads after an error and clears the previous message', async () => {
    const restDay = {
      kind: 'rest_day',
      localDate: '2026-09-20',
      dayOfWeek: 0,
      trainingPlanId: 10,
      planGoal: null,
    } as const;
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonTextResponse(restDay));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useToday());
    await waitFor(() => {
      expect(result.current.error).toBe(TODAY_COPY.todayError);
    });

    act(() => {
      result.current.reload();
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.today).toEqual(restDay);
    expect(result.current.error).toBeNull();
  });
});
