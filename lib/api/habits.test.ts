/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { fetchTodayHabitLogs, setHabitLog, HabitLogClientError } from './habits';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

const habitRow = {
  id: 7,
  userId: 3,
  localDate: '2026-09-20',
  habitKey: 'hydration',
  done: true,
  amount: '1.5',
  createdAt: '2026-09-20T12:00:00.000Z',
  updatedAt: '2026-09-20T12:00:00.000Z',
} as const;

describe('habits client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches today habit logs and returns the parsed rows', async () => {
    global.fetch = jest.fn(async () => jsonResponse([habitRow])) as unknown as typeof fetch;

    await expect(fetchTodayHabitLogs()).resolves.toEqual([habitRow]);
    expect(global.fetch).toHaveBeenCalledWith('/api/habits');
  });

  it('returns an empty array when there are no logs today', async () => {
    global.fetch = jest.fn(async () => jsonResponse([])) as unknown as typeof fetch;

    await expect(fetchTodayHabitLogs()).resolves.toEqual([]);
  });

  it('coerces a missing amount to null and rejects a non-string amount', async () => {
    const { amount: _amount, ...withoutAmount } = habitRow;
    global.fetch = jest.fn(async () => jsonResponse([withoutAmount])) as unknown as typeof fetch;
    await expect(fetchTodayHabitLogs()).resolves.toEqual([{ ...withoutAmount, amount: null }]);

    global.fetch = jest.fn(async () =>
      jsonResponse([{ ...habitRow, amount: 1.5 }]),
    ) as unknown as typeof fetch;
    await expect(fetchTodayHabitLogs()).rejects.toBeInstanceOf(HabitLogClientError);
  });

  it('upserts a habit and returns the API payload unchanged', async () => {
    global.fetch = jest.fn(async () => jsonResponse(habitRow)) as unknown as typeof fetch;

    await expect(setHabitLog({ habitKey: 'hydration', done: true })).resolves.toEqual(habitRow);
    expect(global.fetch).toHaveBeenCalledWith('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitKey: 'hydration', done: true }),
    });
  });

  it('maps 401 responses to an unauthorized client error', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'UNAUTHORIZED', message: 'Autenticación requerida' }, 401),
    ) as unknown as typeof fetch;

    await expect(fetchTodayHabitLogs()).rejects.toMatchObject({
      name: 'HabitLogClientError',
      kind: 'unauthorized',
    });
  });

  it('maps 400 responses to a validation client error', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'VALIDATION', message: 'Registro de hábito inválido' }, 400),
    ) as unknown as typeof fetch;

    await expect(setHabitLog({ habitKey: 'walk', done: false })).rejects.toBeInstanceOf(
      HabitLogClientError,
    );
  });

  it('throws a generic error when the payload shape is invalid', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ nope: true })) as unknown as typeof fetch;

    await expect(setHabitLog({ habitKey: 'walk', done: true })).rejects.toMatchObject({
      kind: 'generic',
    });
  });
});
