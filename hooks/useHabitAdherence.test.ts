import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import { HABIT_TARGET_COPY } from '@/lib/copy/habit-targets';
import type { HabitTargetAdherencePeriod, HabitTargetAdherenceWindow } from '@/types/habit-adherence';
import type { HabitKey } from '@/types/habit';
import type { HabitTargetDayState, HabitTargetWeekday } from '@/types/habit-target';
import { useHabitAdherence } from './useHabitAdherence';

const WEEK_DAYS: ReadonlyArray<{
  localDate: string;
  weekday: HabitTargetWeekday;
  isToday: boolean;
  isFuture: boolean;
}> = [
  { localDate: '2026-09-21', weekday: 1, isToday: false, isFuture: false },
  { localDate: '2026-09-22', weekday: 2, isToday: false, isFuture: false },
  { localDate: '2026-09-23', weekday: 3, isToday: false, isFuture: false },
  { localDate: '2026-09-24', weekday: 4, isToday: true, isFuture: false },
  { localDate: '2026-09-25', weekday: 5, isToday: false, isFuture: true },
  { localDate: '2026-09-26', weekday: 6, isToday: false, isFuture: true },
  { localDate: '2026-09-27', weekday: 0, isToday: false, isFuture: true },
];

function notExpectedStates(): Record<HabitKey, HabitTargetDayState> {
  return {
    hydration: 'not_expected',
    walk: 'not_expected',
    mobility: 'not_expected',
    sleep: 'not_expected',
  };
}

function habitResult() {
  return {
    configurationState: 'not_configured' as const,
    metricState: 'no_expected_days' as const,
    expectedHabitDays: 0,
    completedExpectedHabitDays: 0,
    extraRecordedHabitDays: 0,
    adherencePercent: null,
  };
}

function windowFixture(overrides: Partial<HabitTargetAdherenceWindow> = {}): HabitTargetAdherenceWindow {
  return {
    period: 'week',
    windowStart: '2026-09-21',
    windowEnd: '2026-09-27',
    today: '2026-09-24',
    configurationState: 'not_configured',
    metricState: 'no_expected_days',
    expectedHabitDays: 0,
    completedExpectedHabitDays: 0,
    extraRecordedHabitDays: 0,
    adherencePercent: null,
    perHabit: {
      hydration: habitResult(),
      walk: habitResult(),
      mobility: habitResult(),
      sleep: habitResult(),
    },
    days: WEEK_DAYS.map((day) => ({ ...day, habitStates: notExpectedStates() })),
    ...overrides,
  };
}

/** A parser-valid window with a real denominator, so per-habit sums stay consistent. */
function resultWindow(
  overrides: Partial<HabitTargetAdherenceWindow> = {},
): HabitTargetAdherenceWindow {
  return windowFixture({
    configurationState: 'partially_configured',
    metricState: 'result',
    expectedHabitDays: 2,
    completedExpectedHabitDays: 1,
    adherencePercent: 50,
    perHabit: {
      hydration: habitResult(),
      walk: {
        configurationState: 'configured',
        metricState: 'result',
        expectedHabitDays: 2,
        completedExpectedHabitDays: 1,
        extraRecordedHabitDays: 0,
        adherencePercent: 50,
      },
      mobility: habitResult(),
      sleep: habitResult(),
    },
    ...overrides,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const originalFetch = global.fetch;

function mockFetch(): jest.MockedFunction<typeof fetch> {
  const fetchMock = jest.fn<typeof fetch>();
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('useHabitAdherence', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('loads the requested period through the adherence endpoint', async () => {
    const window = resultWindow({ period: 'month' });
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(window));

    const { result } = renderHook(() => useHabitAdherence('month'));
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

    const { result } = renderHook(() => useHabitAdherence('week'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.adherence).toBeNull();
    expect(result.current.error).toBe(HABIT_TARGET_COPY.historySessionExpired);
  });

  it('maps a generic failure to the honest unavailable copy without ratios', async () => {
    mockFetch().mockResolvedValue(jsonResponse({ code: 'CONFLICT', message: 'Boom' }, 500));

    const { result } = renderHook(() => useHabitAdherence('week'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.adherence).toBeNull();
    expect(result.current.error).toBe(HABIT_TARGET_COPY.historyError);
  });

  it('reuses the cached window for a period while it refreshes', async () => {
    const weekWindow = windowFixture({ period: 'week' });
    const monthPending = deferred<Response>();
    const fetchMock = mockFetch()
      .mockResolvedValueOnce(jsonResponse(weekWindow))
      .mockResolvedValueOnce(jsonResponse(windowFixture({ period: 'month' })))
      .mockReturnValueOnce(monthPending.promise);

    const { result, rerender } = renderHook(
      ({ period }: { period: HabitTargetAdherencePeriod }) => useHabitAdherence(period),
      { initialProps: { period: 'week' as HabitTargetAdherencePeriod } },
    );
    await waitFor(() => {
      expect(result.current.adherence).toEqual(weekWindow);
    });

    rerender({ period: 'month' as HabitTargetAdherencePeriod });
    await waitFor(() => {
      expect(result.current.adherence?.period).toBe('month');
    });

    // Back to week: the cached window is shown immediately, then the fresh request lands.
    rerender({ period: 'week' as HabitTargetAdherencePeriod });
    expect(result.current.loading).toBe(false);
    expect(result.current.adherence?.period).toBe('week');

    monthPending.resolve(jsonResponse(windowFixture({ period: 'week' })));
    await waitFor(() => {
      expect(result.current.adherence?.period).toBe('week');
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/stats/habit-adherence?period=week');
  });

  it('refetches when the mutation revision changes', async () => {
    const first = windowFixture({ period: 'week', expectedHabitDays: 0 });
    const refreshed = resultWindow({ period: 'week' });
    const fetchMock = mockFetch()
      .mockResolvedValueOnce(jsonResponse(first))
      .mockResolvedValueOnce(jsonResponse(refreshed));

    const { result, rerender } = renderHook(
      ({ revision }: { revision: number }) => useHabitAdherence('week', revision),
      { initialProps: { revision: 0 } },
    );
    await waitFor(() => {
      expect(result.current.adherence).toEqual(first);
    });

    rerender({ revision: 1 });

    await waitFor(() => {
      expect(result.current.adherence?.expectedHabitDays).toBe(2);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never exposes a stale period window when the period changes', async () => {
    const weekPending = deferred<Response>();
    const monthPending = deferred<Response>();
    const monthWindow = windowFixture({ period: 'month' });
    const fetchMock = mockFetch()
      .mockReturnValueOnce(weekPending.promise)
      .mockReturnValueOnce(monthPending.promise);

    const { result, rerender } = renderHook(
      ({ period }: { period: HabitTargetAdherencePeriod }) => useHabitAdherence(period),
      { initialProps: { period: 'week' as HabitTargetAdherencePeriod } },
    );
    expect(result.current.loading).toBe(true);

    rerender({ period: 'month' as HabitTargetAdherencePeriod });
    expect(result.current.loading).toBe(true);
    expect(result.current.adherence).toBeNull();

    // The abandoned week response must be ignored even though it resolves later.
    weekPending.resolve(jsonResponse(windowFixture({ period: 'week' })));
    await act(async () => {});
    expect(result.current.adherence).toBeNull();
    expect(result.current.loading).toBe(true);

    monthPending.resolve(jsonResponse(monthWindow));
    await waitFor(() => {
      expect(result.current.adherence?.period).toBe('month');
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/stats/habit-adherence?period=week');
    expect(fetchMock).toHaveBeenCalledWith('/api/stats/habit-adherence?period=month');
  });
});
