/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { fetchHabitActivity, HabitActivityClientError } from './habit-activity';
import type { HabitActivityWindow } from '@/types/habit-activity';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function textResponse(text: string, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  } as Response;
}

const activityWindow: HabitActivityWindow = {
  period: 'week',
  windowStart: '2026-09-21',
  windowEnd: '2026-09-27',
  elapsedDays: 4,
  activeDays: 2,
  perHabit: {
    hydration: { activeDays: 1 },
    walk: { activeDays: 1 },
    mobility: { activeDays: 1 },
    sleep: { activeDays: 0 },
  },
  days: [
    {
      localDate: '2026-09-21',
      weekdayIndex: 0,
      isToday: false,
      isFuture: false,
      recordedKeys: [],
      isRecorded: false,
    },
    {
      localDate: '2026-09-22',
      weekdayIndex: 1,
      isToday: false,
      isFuture: false,
      recordedKeys: ['hydration', 'walk'],
      isRecorded: true,
    },
    {
      localDate: '2026-09-23',
      weekdayIndex: 2,
      isToday: false,
      isFuture: false,
      recordedKeys: [],
      isRecorded: false,
    },
    {
      localDate: '2026-09-24',
      weekdayIndex: 3,
      isToday: true,
      isFuture: false,
      recordedKeys: ['mobility'],
      isRecorded: true,
    },
    {
      localDate: '2026-09-25',
      weekdayIndex: 4,
      isToday: false,
      isFuture: true,
      recordedKeys: [],
      isRecorded: false,
    },
    {
      localDate: '2026-09-26',
      weekdayIndex: 5,
      isToday: false,
      isFuture: true,
      recordedKeys: [],
      isRecorded: false,
    },
    {
      localDate: '2026-09-27',
      weekdayIndex: 6,
      isToday: false,
      isFuture: true,
      recordedKeys: [],
      isRecorded: false,
    },
  ],
  insightStatus: 'insufficient',
  insightMinimumElapsedDays: 7,
};

const GENERIC_MESSAGE = 'No se pudo cargar tu actividad de hábitos';

describe('habit-activity client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns the parsed window for each accepted period', async () => {
    global.fetch = jest.fn(async () => jsonResponse(activityWindow)) as unknown as typeof fetch;

    await expect(fetchHabitActivity('week')).resolves.toEqual(activityWindow);
  });

  it.each(['week', 'month', 'quarter'] as const)(
    'requests the %s window from the stats endpoint',
    async (period) => {
      global.fetch = jest.fn(async () => jsonResponse({ ...activityWindow, period })) as unknown as typeof fetch;

      await fetchHabitActivity(period);

      expect(global.fetch).toHaveBeenCalledWith(`/api/stats/habits?period=${period}`);
    },
  );

  it('rejects a payload with an unknown habit key in perHabit', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({
        ...activityWindow,
        perHabit: { ...activityWindow.perHabit, cardio: { activeDays: 1 } },
      }),
    ) as unknown as typeof fetch;

    await expect(fetchHabitActivity('week')).rejects.toMatchObject({
      name: 'HabitActivityClientError',
      kind: 'generic',
      message: GENERIC_MESSAGE,
    });
  });

  it('rejects a payload missing a catalog habit key in perHabit', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({
        ...activityWindow,
        perHabit: {
          hydration: { activeDays: 1 },
          walk: { activeDays: 1 },
          mobility: { activeDays: 1 },
        },
      }),
    ) as unknown as typeof fetch;

    await expect(fetchHabitActivity('week')).rejects.toMatchObject({ kind: 'generic' });
  });

  it('rejects a day carrying an unknown habit key instead of rendering it partially', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({
        ...activityWindow,
        days: activityWindow.days.map((day) =>
          day.localDate === '2026-09-22'
            ? { ...day, recordedKeys: ['hydration', 'cardio'] }
            : day,
        ),
      }),
    ) as unknown as typeof fetch;

    await expect(fetchHabitActivity('week')).rejects.toMatchObject({
      kind: 'generic',
      message: GENERIC_MESSAGE,
    });
  });

  it('rejects a day whose weekdayIndex is out of the Monday-first range', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({
        ...activityWindow,
        days: activityWindow.days.map((day) =>
          day.localDate === '2026-09-21' ? { ...day, weekdayIndex: 7 } : day,
        ),
      }),
    ) as unknown as typeof fetch;

    await expect(fetchHabitActivity('week')).rejects.toMatchObject({ kind: 'generic' });
  });

  it('rejects a payload whose period is not an accepted window', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ ...activityWindow, period: 'year' }),
    ) as unknown as typeof fetch;

    await expect(fetchHabitActivity('week')).rejects.toMatchObject({ kind: 'generic' });
  });

  it('rejects a payload whose counts are missing or not integers', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ ...activityWindow, insightMinimumElapsedDays: undefined }),
    ) as unknown as typeof fetch;
    await expect(fetchHabitActivity('week')).rejects.toMatchObject({ kind: 'generic' });

    global.fetch = jest.fn(async () =>
      jsonResponse({ ...activityWindow, activeDays: 2.5 }),
    ) as unknown as typeof fetch;
    await expect(fetchHabitActivity('week')).rejects.toMatchObject({ kind: 'generic' });
  });

  it('rejects a payload whose insightStatus is unknown', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ ...activityWindow, insightStatus: 'partial' }),
    ) as unknown as typeof fetch;

    await expect(fetchHabitActivity('week')).rejects.toMatchObject({ kind: 'generic' });
  });

  it('rejects a non-object payload and an empty body', async () => {
    global.fetch = jest.fn(async () => jsonResponse([])) as unknown as typeof fetch;
    await expect(fetchHabitActivity('week')).rejects.toMatchObject({ kind: 'generic' });

    global.fetch = jest.fn(async () => textResponse('', 200)) as unknown as typeof fetch;
    await expect(fetchHabitActivity('week')).rejects.toMatchObject({ kind: 'generic' });
  });

  it('maps 401 responses to an unauthorized client error carrying the API body', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'UNAUTHORIZED', message: 'Autenticación requerida' }, 401),
    ) as unknown as typeof fetch;

    await expect(fetchHabitActivity('week')).rejects.toMatchObject({
      name: 'HabitActivityClientError',
      kind: 'unauthorized',
      status: 401,
      api: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
    });
  });

  it('maps 400 responses to a validation client error', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'VALIDATION', message: 'Período de actividad de hábitos inválido' }, 400),
    ) as unknown as typeof fetch;

    await expect(fetchHabitActivity('week')).rejects.toMatchObject({
      kind: 'validation',
      status: 400,
    });
  });

  it('maps an unreadable error body to a generic client error', async () => {
    global.fetch = jest.fn(async () => textResponse('<html>502</html>', 502)) as unknown as typeof fetch;

    await expect(fetchHabitActivity('week')).rejects.toMatchObject({
      kind: 'generic',
      status: 502,
      api: null,
      message: GENERIC_MESSAGE,
    });
  });

  it('preserves the client error type and message for callers', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ nope: true })) as unknown as typeof fetch;

    const error = await fetchHabitActivity('week').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HabitActivityClientError);
    expect(error).toBeInstanceOf(Error);
    expect((error as HabitActivityClientError).message).toBe(GENERIC_MESSAGE);
  });
});
