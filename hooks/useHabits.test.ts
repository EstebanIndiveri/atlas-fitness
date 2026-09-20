import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import { TODAY_COPY } from '@/lib/copy/today';

import { useHabits } from './useHabits';

function jsonTextResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function habitRow(habitKey: string, done: boolean) {
  return {
    id: habitKey.length,
    userId: 1,
    localDate: '2026-09-20',
    habitKey,
    done,
    createdAt: '2026-09-20T12:00:00.000Z',
    updatedAt: '2026-09-20T12:00:00.000Z',
  };
}

async function waitLoaded(result: { current: { loading: boolean } }): Promise<void> {
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });
}

describe('useHabits', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('loads today habit logs into a complete done map', async () => {
    global.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue(jsonTextResponse([habitRow('hydration', true)])) as unknown as typeof fetch;

    const { result } = renderHook(() => useHabits());
    await waitLoaded(result);

    expect(result.current.doneByKey).toEqual({
      hydration: true,
      walk: false,
      mobility: false,
      sleep: false,
    });
    expect(result.current.error).toBeNull();
  });

  it('optimistically toggles a habit on and persists it', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonTextResponse([]))
      .mockResolvedValueOnce(jsonTextResponse(habitRow('walk', true)));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useHabits());
    await waitLoaded(result);

    await act(async () => {
      await result.current.toggle('walk');
    });

    expect(result.current.doneByKey.walk).toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitKey: 'walk', done: true }),
    });
  });

  it('toggles a loaded habit off and sends done:false to the API', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonTextResponse([habitRow('hydration', true)]))
      .mockResolvedValueOnce(jsonTextResponse(habitRow('hydration', false)));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useHabits());
    await waitLoaded(result);
    expect(result.current.doneByKey.hydration).toBe(true);

    await act(async () => {
      await result.current.toggle('hydration');
    });

    expect(result.current.doneByKey.hydration).toBe(false);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitKey: 'hydration', done: false }),
    });
  });

  it('rolls back the optimistic toggle and surfaces an error when saving fails', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonTextResponse([]))
      .mockResolvedValueOnce(
        jsonTextResponse({ code: 'VALIDATION', message: 'Registro de hábito inválido' }, false, 400),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useHabits());
    await waitLoaded(result);

    await act(async () => {
      await result.current.toggle('sleep');
    });

    expect(result.current.doneByKey.sleep).toBe(false);
    expect(result.current.error).toBe('Registro de hábito inválido');
  });

  it('maps an unauthorized load error to the session-expired copy', async () => {
    global.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonTextResponse({ code: 'UNAUTHORIZED', message: 'Autenticación requerida' }, false, 401),
      ) as unknown as typeof fetch;

    const { result } = renderHook(() => useHabits());
    await waitLoaded(result);

    expect(result.current.error).toBe(TODAY_COPY.habitsSessionExpired);
  });
});
