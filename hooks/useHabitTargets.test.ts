import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import { HABIT_TARGET_COPY } from '@/lib/copy/habit-targets';
import { cordobaLocalDate, sundayFirstLocalDateWeekdayIndex } from '@/lib/time/cordoba';
import { useHabitTargets } from './useHabitTargets';
import type { HabitTargetResponse } from '@/lib/api/habit-targets';
import type { HabitTargetWeekday } from '@/types/habit-target';

const TODAY = cordobaLocalDate();
const TODAY_WEEKDAY = sundayFirstLocalDateWeekdayIndex(TODAY) as HabitTargetWeekday;

function otherWeekday(): HabitTargetWeekday {
  return ((TODAY_WEEKDAY + 1) % 7) as HabitTargetWeekday;
}

function target(overrides: Partial<HabitTargetResponse> = {}): HabitTargetResponse {
  return {
    id: 7,
    userId: 1,
    habitKey: 'walk',
    effectiveFrom: TODAY,
    effectiveTo: null,
    version: 1,
    weekdays: [TODAY_WEEKDAY],
    createdAt: '2026-09-24T15:00:00.000Z',
    updatedAt: '2026-09-24T15:00:00.000Z',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

const originalFetch = global.fetch;

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

type Route = (init?: FetchInit) => Response;

function mockRoutes(routes: Record<string, Route>): jest.MockedFunction<typeof fetch> {
  const fetchMock = jest.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const route = routes[`${method} ${url}`];
    if (!route) {
      throw new Error(`Unexpected request: ${method} ${url}`);
    }
    return route(init);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

async function waitLoaded(result: { current: { loading: boolean } }): Promise<void> {
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });
}

describe('useHabitTargets', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('starts a fresh user as not configured with no objective today', async () => {
    mockRoutes({ 'GET /api/habit-targets': () => jsonResponse([]) });

    const { result } = renderHook(() => useHabitTargets());
    expect(result.current.loading).toBe(true);

    await waitLoaded(result);

    expect(result.current.targets).toEqual({
      hydration: null,
      walk: null,
      mobility: null,
      sleep: null,
    });
    expect(result.current.configuredCount).toBe(0);
    expect(result.current.expectedTodayByKey).toEqual({
      hydration: false,
      walk: false,
      mobility: false,
      sleep: false,
    });
    expect(result.current.error).toBeNull();
  });

  it('loads current targets and marks only habits expected today', async () => {
    mockRoutes({
      'GET /api/habit-targets': () =>
        jsonResponse([target({ weekdays: [TODAY_WEEKDAY] }), target({ id: 9, habitKey: 'sleep', weekdays: [otherWeekday()] })]),
    });

    const { result } = renderHook(() => useHabitTargets());
    await waitLoaded(result);

    expect(result.current.configuredCount).toBe(2);
    expect(result.current.expectedTodayByKey.walk).toBe(true);
    expect(result.current.expectedTodayByKey.sleep).toBe(false);
    expect(result.current.targets.walk?.id).toBe(7);
  });

  it('creates a target with the null token and refreshes the list from the server', async () => {
    const created = target({ id: 11, weekdays: [1, 3] });
    const fetchMock = mockRoutes({
      'GET /api/habit-targets': () => jsonResponse([]),
      'PUT /api/habit-targets/walk': () => jsonResponse(created),
    });
    // The post-mutation refetch returns the created target.
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        const calls = fetchMock.mock.calls.filter(
          (call) => (call[1] as FetchInit | undefined)?.method === 'PUT',
        ).length;
        return jsonResponse(calls > 0 ? [created] : []);
      }
      if (`${method} ${url}` === 'PUT /api/habit-targets/walk') {
        return jsonResponse(created);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { result } = renderHook(() => useHabitTargets());
    await waitLoaded(result);

    let ok = false;
    await act(async () => {
      ok = await result.current.save('walk', [1, 3]);
    });

    expect(ok).toBe(true);
    expect(result.current.error).toBeNull();
    await waitFor(() => {
      expect(result.current.targets.walk?.id).toBe(11);
    });
    expect(result.current.revision).toBe(1);

    const putCall = fetchMock.mock.calls.find(
      (call) => (call[1] as FetchInit | undefined)?.method === 'PUT',
    );
    expect(putCall?.[0]).toBe('/api/habit-targets/walk');
    expect(JSON.parse((putCall?.[1] as FetchInit).body as string)).toEqual({
      weekdays: [1, 3],
      expectedTargetId: null,
      expectedVersion: null,
    });
  });

  it('updates an existing target with its id/version compare-and-swap token', async () => {
    const existing = target({ id: 7, version: 3, weekdays: [1] });
    const updated = target({ id: 7, version: 4, weekdays: [2, 4] });
    const fetchMock = mockRoutes({
      'GET /api/habit-targets': () => jsonResponse([existing]),
      'PUT /api/habit-targets/walk': () => jsonResponse(updated),
    });
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        const putDone = fetchMock.mock.calls.some(
          (call) => (call[1] as FetchInit | undefined)?.method === 'PUT',
        );
        return jsonResponse(putDone ? [updated] : [existing]);
      }
      if (`${method} ${url}` === 'PUT /api/habit-targets/walk') {
        return jsonResponse(updated);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { result } = renderHook(() => useHabitTargets());
    await waitLoaded(result);

    await act(async () => {
      await result.current.save('walk', [2, 4]);
    });

    const putCall = fetchMock.mock.calls.find(
      (call) => (call[1] as FetchInit | undefined)?.method === 'PUT',
    );
    expect(JSON.parse((putCall?.[1] as FetchInit).body as string)).toEqual({
      weekdays: [2, 4],
      expectedTargetId: 7,
      expectedVersion: 3,
    });
    await waitFor(() => {
      expect(result.current.targets.walk?.version).toBe(4);
    });
  });

  it('recovers server truth and flags conflict when a save uses a stale version', async () => {
    const stale = target({ id: 7, version: 1, weekdays: [1] });
    const serverTruth = target({ id: 7, version: 5, weekdays: [5] });
    const fetchMock = mockRoutes({
      'GET /api/habit-targets': () => jsonResponse([stale]),
      'PUT /api/habit-targets/walk': () =>
        jsonResponse({ code: 'CONFLICT', message: 'stale' }, 409),
    });
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        const hasConflict = fetchMock.mock.calls.some(
          (call) => (call[1] as FetchInit | undefined)?.method === 'PUT',
        );
        return jsonResponse(hasConflict ? [serverTruth] : [stale]);
      }
      if (`${method} ${url}` === 'PUT /api/habit-targets/walk') {
        return jsonResponse({ code: 'CONFLICT', message: 'stale' }, 409);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { result } = renderHook(() => useHabitTargets());
    await waitLoaded(result);

    let ok = true;
    await act(async () => {
      ok = await result.current.save('walk', [2, 4]);
    });

    expect(ok).toBe(false);
    expect(result.current.error?.kind).toBe('conflict');
    expect(result.current.error?.message).toBe(HABIT_TARGET_COPY.conflict);
    await waitFor(() => {
      expect(result.current.targets.walk?.version).toBe(5);
    });
  });

  it('deactivates with the current token and clears the active target', async () => {
    const existing = target({ id: 7, version: 2, weekdays: [1] });
    const fetchMock = mockRoutes({
      'GET /api/habit-targets': () => jsonResponse([existing]),
      'DELETE /api/habit-targets/walk': () => jsonResponse({ activeTarget: null }),
    });
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        const deleted = fetchMock.mock.calls.some(
          (call) => (call[1] as FetchInit | undefined)?.method === 'DELETE',
        );
        return jsonResponse(deleted ? [] : [existing]);
      }
      if (`${method} ${url}` === 'DELETE /api/habit-targets/walk') {
        return jsonResponse({ activeTarget: null });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { result } = renderHook(() => useHabitTargets());
    await waitLoaded(result);

    let ok = false;
    await act(async () => {
      ok = await result.current.deactivate('walk');
    });

    expect(ok).toBe(true);
    await waitFor(() => {
      expect(result.current.targets.walk).toBeNull();
    });
    expect(result.current.revision).toBe(1);

    const deleteCall = fetchMock.mock.calls.find(
      (call) => (call[1] as FetchInit | undefined)?.method === 'DELETE',
    );
    expect(JSON.parse((deleteCall?.[1] as FetchInit).body as string)).toEqual({
      expectedTargetId: 7,
      expectedVersion: 2,
    });
  });

  it('keeps existing targets when a reload fails, so stale truth is never lost', async () => {
    const existing = target({ id: 7, weekdays: [TODAY_WEEKDAY] });
    const fetchMock = mockRoutes({ 'GET /api/habit-targets': () => jsonResponse([existing]) });

    const { result } = renderHook(() => useHabitTargets());
    await waitLoaded(result);
    expect(result.current.targets.walk?.id).toBe(7);

    (fetchMock as jest.Mock).mockImplementation(async () => jsonResponse({ code: 'BOOM' }, 500));
    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.targets.walk?.id).toBe(7);
    expect(result.current.expectedTodayByKey.walk).toBe(true);
  });

  it('maps an expired session and retries through a fresh load', async () => {
    const fetchMock = mockRoutes({
      'GET /api/habit-targets': () => jsonResponse({ code: 'UNAUTHORIZED' }, 401),
    });

    const { result } = renderHook(() => useHabitTargets());
    await waitLoaded(result);

    expect(result.current.error?.kind).toBe('unauthorized');
    expect(result.current.error?.message).toBe(HABIT_TARGET_COPY.sessionExpired);

    fetchMock.mockImplementation(async () => jsonResponse([]));
    act(() => {
      result.current.reload();
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBeNull();
  });

  it('surfaces a save validation error without dropping the loaded target', async () => {
    const existing = target({ id: 7, weekdays: [1] });
    mockRoutes({
      'GET /api/habit-targets': () => jsonResponse([existing]),
      'PUT /api/habit-targets/walk': () =>
        jsonResponse({ code: 'VALIDATION', message: 'Semana inválida' }, 400),
    });

    const { result } = renderHook(() => useHabitTargets());
    await waitLoaded(result);

    await act(async () => {
      await result.current.save('walk', []);
    });

    expect(result.current.error?.kind).toBe('validation');
    expect(result.current.error?.message).toBe('Semana inválida');
    expect(result.current.targets.walk?.id).toBe(7);
  });
});
