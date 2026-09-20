/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { fetchToday } from './today';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('today client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads a workout today payload without changing fields', async () => {
    const payload = {
      kind: 'workout',
      localDate: '2026-09-21',
      dayOfWeek: 1,
      trainingPlanId: 3,
      scheduledRoutineId: 4,
      routineId: 5,
      routineName: 'Tren superior',
      planGoal: 'Hipertrofia',
      dayReason: 'Empuje pesado hoy',
    } as const;
    global.fetch = jest.fn(async () => jsonResponse(payload)) as unknown as typeof fetch;

    await expect(fetchToday()).resolves.toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith('/api/today');
  });

  it('loads a no_plan today payload', async () => {
    const payload = {
      kind: 'no_plan',
      localDate: '2026-09-19',
      dayOfWeek: 6,
    } as const;
    global.fetch = jest.fn(async () => jsonResponse(payload)) as unknown as typeof fetch;

    await expect(fetchToday()).resolves.toEqual(payload);
  });

  it('throws a typed error when the API responds with non-200', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'UNAUTHORIZED', message: 'Autenticación requerida' }, 401),
    ) as unknown as typeof fetch;

    await expect(fetchToday()).rejects.toMatchObject({
      name: 'TodayClientError',
      kind: 'unauthorized',
      status: 401,
      api: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
    });
  });
});
