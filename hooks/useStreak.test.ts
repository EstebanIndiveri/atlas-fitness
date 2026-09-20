import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';
import { STREAK_COPY } from '@/lib/copy/streak';
import { useStreak } from './useStreak';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('useStreak', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads streak stats from GET /api/stats/streak', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ currentStreak: 2, longestStreak: 5, lastActiveDate: '2026-09-18' }),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useStreak());
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.streak).toEqual({
      currentStreak: 2,
      longestStreak: 5,
      lastActiveDate: '2026-09-18',
    });
  });

  it('surfaces a Spanish error when the request fails', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'UNAUTHORIZED' }, false, 401),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useStreak());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.streak).toBeNull();
    expect(result.current.error).toBe(STREAK_COPY.error);
  });

  it('retries after an error', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, false, 500))
      .mockResolvedValueOnce(
        jsonResponse({ currentStreak: 0, longestStreak: 0, lastActiveDate: null }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useStreak());
    await waitFor(() => {
      expect(result.current.error).toBe(STREAK_COPY.error);
    });

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.streak?.currentStreak).toBe(0);
  });
});
