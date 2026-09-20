/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { fetchTodayCheckIn, recordCheckIn } from './checkin';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('check-in client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('records a check-in and returns the API payload without changing fields', async () => {
    const payload = {
      id: 10,
      userId: 4,
      localDate: '2026-09-19',
      mood: 4,
      energy: 'low',
      note: 'Me costó arrancar.',
      createdAt: '2026-09-19T15:00:00.000Z',
      updatedAt: '2026-09-19T15:00:00.000Z',
    } as const;
    global.fetch = jest.fn(async () => jsonResponse(payload)) as unknown as typeof fetch;

    await expect(recordCheckIn({ mood: 4, energy: 'low', note: 'Me costó arrancar.' })).resolves.toEqual(
      payload,
    );
    expect(global.fetch).toHaveBeenCalledWith('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood: 4, energy: 'low', note: 'Me costó arrancar.' }),
    });
  });

  it('loads today check-in when it exists', async () => {
    const payload = {
      id: 11,
      userId: 4,
      localDate: '2026-09-19',
      mood: 5,
      energy: null,
      note: null,
      createdAt: '2026-09-19T15:00:00.000Z',
      updatedAt: '2026-09-19T15:00:00.000Z',
    } as const;
    global.fetch = jest.fn(async () => jsonResponse(payload)) as unknown as typeof fetch;

    await expect(fetchTodayCheckIn()).resolves.toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith('/api/checkin');
  });

  it('loads null when today has no check-in', async () => {
    global.fetch = jest.fn(async () => jsonResponse(null)) as unknown as typeof fetch;

    await expect(fetchTodayCheckIn()).resolves.toBeNull();
  });

  it('throws a typed error when the API responds with non-2xx', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'VALIDATION', message: 'Check-in diario inválido' }, 400),
    ) as unknown as typeof fetch;

    await expect(recordCheckIn({ mood: 0 })).rejects.toMatchObject({
      name: 'CheckInClientError',
      kind: 'validation',
      status: 400,
      api: { code: 'VALIDATION', message: 'Check-in diario inválido' },
    });
  });
});
