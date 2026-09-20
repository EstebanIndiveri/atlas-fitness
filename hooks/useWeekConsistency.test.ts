import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';
import { TODAY_COPY } from '@/lib/copy/today';
import type { WeekConsistency, WeekDayConsistency } from '@/types/week';
import { useWeekConsistency } from './useWeekConsistency';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function buildDay(overrides: Partial<WeekDayConsistency> & { date: string; weekdayIndex: number }): WeekDayConsistency {
  return { active: false, isToday: false, isFuture: false, ...overrides };
}

function buildWeek(): WeekConsistency {
  return {
    weekStart: '2026-09-21',
    weekEnd: '2026-09-27',
    activeCount: 1,
    days: [
      buildDay({ date: '2026-09-21', weekdayIndex: 0, active: true }),
      buildDay({ date: '2026-09-22', weekdayIndex: 1 }),
      buildDay({ date: '2026-09-23', weekdayIndex: 2 }),
      buildDay({ date: '2026-09-24', weekdayIndex: 3, isToday: true }),
      buildDay({ date: '2026-09-25', weekdayIndex: 4, isFuture: true }),
      buildDay({ date: '2026-09-26', weekdayIndex: 5, isFuture: true }),
      buildDay({ date: '2026-09-27', weekdayIndex: 6, isFuture: true }),
    ],
  };
}

describe('useWeekConsistency', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads week consistency from GET /api/stats/week', async () => {
    const week = buildWeek();
    global.fetch = jest.fn(async () => jsonResponse(week)) as unknown as typeof fetch;

    const { result } = renderHook(() => useWeekConsistency());
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.week).toEqual(week);
  });

  it('surfaces a Spanish error when the request fails', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'UNAUTHORIZED' }, false, 401),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useWeekConsistency());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.week).toBeNull();
    expect(result.current.error).toBe(TODAY_COPY.weekError);
  });

  it('rejects a malformed shape that does not have seven days', async () => {
    const week = buildWeek();
    global.fetch = jest.fn(async () =>
      jsonResponse({ ...week, days: week.days.slice(0, 3) }),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useWeekConsistency());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.week).toBeNull();
    expect(result.current.error).toBe(TODAY_COPY.weekError);
  });

  it('retries after an error', async () => {
    const week = buildWeek();
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, false, 500))
      .mockResolvedValueOnce(jsonResponse(week));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useWeekConsistency());
    await waitFor(() => {
      expect(result.current.error).toBe(TODAY_COPY.weekError);
    });

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current.week).toEqual(week);
    });
    expect(result.current.error).toBeNull();
  });
});
