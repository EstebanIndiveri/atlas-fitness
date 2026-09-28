/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import { PROGRESS_COPY } from '@/lib/copy/progress';
import { TODAY_COPY } from '@/lib/copy/today';
import type { HabitActivityPeriod, HabitActivityWindow } from '@/types/habit-activity';
import { useHabitActivity } from './useHabitActivity';

const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function activityWindow(overrides: Partial<HabitActivityWindow> = {}): HabitActivityWindow {
  return {
    period: 'week',
    windowStart: '2026-09-21',
    windowEnd: '2026-09-27',
    elapsedDays: 4,
    activeDays: 2,
    perHabit: {
      hydration: { activeDays: 1 },
      walk: { activeDays: 1 },
      mobility: { activeDays: 0 },
      sleep: { activeDays: 0 },
    },
    days: [],
    insightStatus: 'insufficient',
    insightMinimumElapsedDays: 7,
    ...overrides,
  };
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

describe('useHabitActivity', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('loads the requested period through the habit-activity endpoint', async () => {
    const window = activityWindow({ period: 'month' });
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(window));

    const { result } = renderHook(() => useHabitActivity('month'));
    expect(result.current.loading).toBe(true);
    expect(result.current.activity).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/stats/habits?period=month');
    expect(result.current.activity).toEqual(window);
    expect(result.current.error).toBeNull();
  });

  it('maps an unauthorized response to the session-expired copy', async () => {
    mockFetch().mockResolvedValue(
      jsonResponse({ code: 'UNAUTHORIZED', message: 'Autenticación requerida' }, 401),
    );

    const { result } = renderHook(() => useHabitActivity('week'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activity).toBeNull();
    expect(result.current.error).toBe(TODAY_COPY.habitsSessionExpired);
  });

  it('maps a validation failure to the period-scoped unavailable copy', async () => {
    mockFetch().mockResolvedValue(
      jsonResponse({ code: 'VALIDATION', message: 'Período inválido' }, 400),
    );

    const { result } = renderHook(() => useHabitActivity('week'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activity).toBeNull();
    expect(result.current.error).toBe(PROGRESS_COPY.habitActivity.unavailable);
  });

  it('maps a generic failure to the period-scoped unavailable copy', async () => {
    mockFetch().mockResolvedValue(jsonResponse({ code: 'CONFLICT', message: 'Boom' }, 500));

    const { result } = renderHook(() => useHabitActivity('week'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activity).toBeNull();
    expect(result.current.error).toBe(PROGRESS_COPY.habitActivity.unavailable);
  });

  it('treats a body that fails transport validation as an error, never as partial data', async () => {
    const skewed = activityWindow();
    mockFetch().mockResolvedValue(
      jsonResponse({ ...skewed, perHabit: { hydration: { activeDays: 1 } } }),
    );

    const { result } = renderHook(() => useHabitActivity('week'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activity).toBeNull();
    expect(result.current.error).toBe(PROGRESS_COPY.habitActivity.unavailable);
  });

  it('never exposes the previous period’s window once another period is requested', async () => {
    const weekWindow = activityWindow({ period: 'week' });
    const monthWindow = activityWindow({ period: 'month', activeDays: 6 });
    const pending = deferred<Response>();
    const fetchMock = mockFetch()
      .mockResolvedValueOnce(jsonResponse(weekWindow))
      .mockReturnValueOnce(pending.promise);

    const { result, rerender } = renderHook(
      ({ period }: { period: HabitActivityPeriod }) => useHabitActivity(period),
      { initialProps: { period: 'week' as HabitActivityPeriod } },
    );
    await waitFor(() => {
      expect(result.current.activity).toEqual(weekWindow);
    });

    rerender({ period: 'month' as HabitActivityPeriod });

    expect(result.current.loading).toBe(true);
    expect(result.current.activity).toBeNull();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/stats/habits?period=month');

    pending.resolve(jsonResponse(monthWindow));
    await waitFor(() => {
      expect(result.current.activity).toEqual(monthWindow);
    });
  });

  it('refetches after a failure and clears the error', async () => {
    const window = activityWindow({ period: 'week' });
    const fetchMock = mockFetch()
      .mockResolvedValueOnce(jsonResponse({ code: 'CONFLICT', message: 'Boom' }, 500))
      .mockResolvedValueOnce(jsonResponse(window));

    const { result } = renderHook(() => useHabitActivity('week'));
    await waitFor(() => {
      expect(result.current.error).toBe(PROGRESS_COPY.habitActivity.unavailable);
    });

    act(() => {
      result.current.reload();
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.activity).toEqual(window);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
  });
});
