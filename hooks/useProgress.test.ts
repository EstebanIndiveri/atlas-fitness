import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import { UI_COPY } from '@/lib/copy/ui';

import { useProgress } from './useProgress';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

const weekBody = {
  weekStart: '2026-09-21',
  weekEnd: '2026-09-27',
  activeCount: 2,
  days: Array.from({ length: 7 }, (_, index) => ({
    date: `2026-09-${String(21 + index).padStart(2, '0')}`,
    weekdayIndex: index,
    active: index < 2,
    isToday: index === 3,
    isFuture: index > 3,
  })),
};

const summaryBody = {
  period: 'month',
  fromLocalDate: '2026-08-26',
  toLocalDate: '2026-09-24',
  completedSessions: 1,
  totalDurationMinutes: 61,
  sessions: [
    {
      workoutId: 10,
      startedAt: '2026-09-24T12:00:00.000Z',
      durationMinutes: 61,
      routineName: 'Torso fuerte',
    },
  ],
};

describe('useProgress', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads progress summary and week consistency on mount', async () => {
    const fetchMock = jest.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === '/api/progress/summary?period=month') {
        return jsonResponse(summaryBody);
      }
      if (url === '/api/stats/week') {
        return jsonResponse(weekBody);
      }
      return jsonResponse({ code: 'NOT_FOUND' }, false, 404);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useProgress());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.summary).toEqual(summaryBody);
    expect(result.current.week).toEqual(weekBody);
    expect(result.current.error).toBeNull();
  });

  it('maps HTTP errors to an error state with null data', async () => {
    global.fetch = jest.fn<typeof fetch>(async (input) => {
      if (String(input).startsWith('/api/progress/summary')) {
        return jsonResponse({ code: 'SERVICE_UNAVAILABLE' }, false, 503);
      }
      return jsonResponse(weekBody);
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useProgress());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.summary).toBeNull();
    expect(result.current.week).toBeNull();
    expect(result.current.error).toBe(UI_COPY.progressError);
  });

  it('rejects invalid payloads', async () => {
    global.fetch = jest.fn<typeof fetch>(async (input) => {
      if (String(input).startsWith('/api/progress/summary')) {
        return jsonResponse({ period: 'month', completedSessions: '1' });
      }
      return jsonResponse(weekBody);
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useProgress());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(UI_COPY.progressError);
    expect(result.current.summary).toBeNull();
  });

  it('re-fetches the summary when the period changes', async () => {
    const fetchMock = jest.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url === '/api/progress/summary?period=month') {
        return jsonResponse(summaryBody);
      }
      if (url === '/api/progress/summary?period=week') {
        return jsonResponse({ ...summaryBody, period: 'week', completedSessions: 2 });
      }
      return jsonResponse(weekBody);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useProgress());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setPeriod('week');
    });

    await waitFor(() => {
      expect(result.current.summary?.period).toBe('week');
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/progress/summary?period=month');
    expect(fetchMock).toHaveBeenCalledWith('/api/progress/summary?period=week');
  });
});
