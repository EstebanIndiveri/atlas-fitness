import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import type { DailyCheckInInput, DailyCheckInResponse } from '@/lib/api/checkin';
import { TODAY_COPY } from '@/lib/copy/today';

import { useDailyCheckin } from './useDailyCheckin';

function jsonTextResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function emptyTextResponse(): Response {
  return { ok: true, status: 200, text: async () => '' } as Response;
}

const recordedCheckin: DailyCheckInResponse = {
  id: 1,
  userId: 2,
  localDate: '2026-09-19',
  mood: 4,
  energy: 'high',
  note: 'Buen día',
  createdAt: '2026-09-19T10:00:00.000Z',
  updatedAt: '2026-09-19T10:00:00.000Z',
};
const checkinInput: DailyCheckInInput = { mood: 4, energy: 'high', note: 'Buen día' };

async function waitLoaded(result: { current: { loading: boolean } }): Promise<void> {
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });
}

describe('useDailyCheckin', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads the recorded daily check-in on mount', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(jsonTextResponse(recordedCheckin));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useDailyCheckin());
    expect(result.current.loading).toBe(true);
    await waitLoaded(result);

    expect(fetchMock).toHaveBeenCalledWith('/api/checkin');
    expect(result.current.checkin).toEqual(recordedCheckin);
    expect(result.current.error).toBeNull();
  });

  it('treats a null daily check-in as an empty state without error', async () => {
    global.fetch = jest.fn(async () => emptyTextResponse()) as unknown as typeof fetch;

    const { result } = renderHook(() => useDailyCheckin());
    await waitLoaded(result);

    expect(result.current.checkin).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('maps unauthorized load errors to the session expired copy', async () => {
    global.fetch = jest.fn(async () =>
      jsonTextResponse({ code: 'UNAUTHORIZED', message: 'Autenticación requerida' }, false, 401),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useDailyCheckin());
    await waitLoaded(result);

    expect(result.current.checkin).toBeNull();
    expect(result.current.error).toBe(TODAY_COPY.checkinSessionExpired);
  });

  it('maps generic load errors to the generic check-in copy', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useDailyCheckin());
    await waitLoaded(result);

    expect(result.current.checkin).toBeNull();
    expect(result.current.error).toBe(TODAY_COPY.checkinError);
  });

  it('submits a daily check-in, updates state, returns the saved row, and resets saving', async () => {
    let resolveSave: (response: Response) => void = () => undefined;
    const saveResponse = new Promise<Response>((resolve) => {
      resolveSave = resolve;
    });
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(emptyTextResponse())
      .mockReturnValueOnce(saveResponse);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useDailyCheckin());
    await waitLoaded(result);

    let savedPromise: Promise<DailyCheckInResponse | null> = Promise.resolve(null);
    act(() => {
      savedPromise = result.current.submit(checkinInput);
    });
    expect(result.current.saving).toBe(true);

    let saved: DailyCheckInResponse | null = null;
    await act(async () => {
      resolveSave(jsonTextResponse(recordedCheckin));
      saved = await savedPromise;
    });

    expect(fetchMock).toHaveBeenLastCalledWith('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkinInput),
    });
    expect(saved).toEqual(recordedCheckin);
    expect(result.current.checkin).toEqual(recordedCheckin);
    expect(result.current.saving).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('keeps a saved check-in when an older initial load completes afterward', async () => {
    let resolveLoad: (response: Response) => void = () => undefined;
    const loadResponse = new Promise<Response>((resolve) => {
      resolveLoad = resolve;
    });
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockReturnValueOnce(loadResponse)
      .mockResolvedValueOnce(jsonTextResponse(recordedCheckin));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useDailyCheckin());
    await act(async () => {
      await result.current.submit(checkinInput);
    });
    expect(result.current.checkin).toEqual(recordedCheckin);

    await act(async () => {
      resolveLoad(emptyTextResponse());
      await loadResponse;
    });
    await waitLoaded(result);
    expect(result.current.checkin).toEqual(recordedCheckin);
    expect(result.current.error).toBeNull();

  });

  it('ignores an older initial load failure after a successful submit', async () => {
    let rejectLoad: (reason: Error) => void = () => undefined;
    const loadResponse = new Promise<Response>((_resolve, reject) => {
      rejectLoad = reject;
    });
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockReturnValueOnce(loadResponse)
      .mockResolvedValueOnce(jsonTextResponse(recordedCheckin));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useDailyCheckin());
    await act(async () => {
      await result.current.submit(checkinInput);
    });
    await act(async () => {
      rejectLoad(new Error('older load failed'));
      await loadResponse.catch(() => undefined);
    });
    await waitLoaded(result);

    expect(result.current.checkin).toEqual(recordedCheckin);
    expect(result.current.error).toBeNull();
  });

  it('maps validation submit errors to the API message and returns null without throwing', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(emptyTextResponse())
      .mockResolvedValueOnce(
        jsonTextResponse({ code: 'VALIDATION', message: 'El ánimo debe estar entre 1 y 5' }, false, 400),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useDailyCheckin());
    await waitLoaded(result);

    let saved: DailyCheckInResponse | null = recordedCheckin;
    await act(async () => {
      saved = await result.current.submit({ mood: 9 });
    });

    expect(saved).toBeNull();
    expect(result.current.checkin).toBeNull();
    expect(result.current.error).toBe('El ánimo debe estar entre 1 y 5');
    expect(result.current.saving).toBe(false);
  });
});
