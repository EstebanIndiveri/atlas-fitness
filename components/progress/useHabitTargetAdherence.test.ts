/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import { PROGRESS_COPY } from '@/lib/copy/progress';
import { TODAY_COPY } from '@/lib/copy/today';
import { computeHabitTargetAdherence } from '@/lib/services/habit-target-adherence';
import type {
  HabitTargetAdherencePeriod,
  HabitTargetAdherenceWindow,
} from '@/types/habit-adherence';
import { useHabitTargetAdherence } from './useHabitTargetAdherence';

const originalFetch = global.fetch;
const TODAY = '2026-09-24';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function resultWindow(period: HabitTargetAdherencePeriod): HabitTargetAdherenceWindow {
  return computeHabitTargetAdherence({
    period,
    today: TODAY,
    schedules: [
      {
        habitKey: 'hydration',
        effectiveFrom: '2026-09-01',
        effectiveTo: null,
        version: 1,
        weekdays: [4],
      },
    ],
    logs: [{ localDate: TODAY, habitKey: 'hydration', done: true }],
  });
}

function emptyWindow(period: HabitTargetAdherencePeriod): HabitTargetAdherenceWindow {
  return computeHabitTargetAdherence({ period, today: TODAY, schedules: [], logs: [] });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function mockFetch(): jest.MockedFunction<typeof fetch> {
  const fetchMock = jest.fn<typeof fetch>();
  global.fetch = fetchMock;
  return fetchMock;
}

describe('useHabitTargetAdherence', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('loads the requested period through the adherence endpoint', async () => {
    const window = resultWindow('month');
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(window));

    const { result } = renderHook(() => useHabitTargetAdherence('month'));
    expect(result.current.loading).toBe(true);
    expect(result.current.adherence).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/stats/habit-adherence?period=month');
    expect(result.current.adherence).toEqual(window);
    expect(result.current.error).toBeNull();
  });

  it('maps an unauthorized response to the session-expired copy', async () => {
    mockFetch().mockResolvedValue(
      jsonResponse({ code: 'UNAUTHORIZED', message: 'Autenticación requerida' }, 401),
    );

    const { result } = renderHook(() => useHabitTargetAdherence('week'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.adherence).toBeNull();
    expect(result.current.error).toBe(TODAY_COPY.habitsSessionExpired);
  });

  it('maps a validation failure to the period-scoped unavailable copy', async () => {
    mockFetch().mockResolvedValue(
      jsonResponse({ code: 'VALIDATION', message: 'Período inválido' }, 400),
    );

    const { result } = renderHook(() => useHabitTargetAdherence('week'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(PROGRESS_COPY.habitTarget.unavailable);
  });

  it('treats a body that fails transport validation as an error, never as partial data', async () => {
    mockFetch().mockResolvedValue(
      jsonResponse({ ...resultWindow('week'), expectedHabitDays: 999 }),
    );

    const { result } = renderHook(() => useHabitTargetAdherence('week'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.adherence).toBeNull();
    expect(result.current.error).toBe(PROGRESS_COPY.habitTarget.unavailable);
  });

  it('never exposes the previous period’s window once another period is requested', async () => {
    const weekWindow = resultWindow('week');
    const monthWindow = resultWindow('month');
    const pending = deferred<Response>();
    const fetchMock = mockFetch()
      .mockResolvedValueOnce(jsonResponse(weekWindow))
      .mockReturnValueOnce(pending.promise);

    const { result, rerender } = renderHook(
      ({ period }: { period: HabitTargetAdherencePeriod }) =>
        useHabitTargetAdherence(period),
      { initialProps: { period: 'week' as HabitTargetAdherencePeriod } },
    );
    await waitFor(() => {
      expect(result.current.adherence).toEqual(weekWindow);
    });

    rerender({ period: 'month' as HabitTargetAdherencePeriod });

    expect(result.current.loading).toBe(true);
    expect(result.current.adherence).toBeNull();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/stats/habit-adherence?period=month');

    pending.resolve(jsonResponse(monthWindow));
    await waitFor(() => {
      expect(result.current.adherence).toEqual(monthWindow);
    });
  });

  it('refetches after a failure and clears the error', async () => {
    const window = emptyWindow('week');
    const fetchMock = mockFetch()
      .mockResolvedValueOnce(jsonResponse({ code: 'CONFLICT', message: 'Boom' }, 500))
      .mockResolvedValueOnce(jsonResponse(window));

    const { result } = renderHook(() => useHabitTargetAdherence('week'));
    await waitFor(() => {
      expect(result.current.error).toBe(PROGRESS_COPY.habitTarget.unavailable);
    });

    act(() => {
      result.current.reload();
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.adherence).toEqual(window);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
