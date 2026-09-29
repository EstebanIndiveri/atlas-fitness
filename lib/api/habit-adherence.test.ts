/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { fetchHabitTargetAdherence, HabitTargetAdherenceClientError } from './habit-adherence';
import type { HabitKey } from '@/types/habit';
import type {
  HabitTargetAdherenceWindow,
  HabitTargetHabitAdherence,
} from '@/types/habit-adherence';
import type { HabitTargetDayState } from '@/types/habit-target';

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

function zeroHabit(): HabitTargetHabitAdherence {
  return {
    configurationState: 'not_configured',
    metricState: 'no_expected_days',
    expectedHabitDays: 0,
    completedExpectedHabitDays: 0,
    extraRecordedHabitDays: 0,
    adherencePercent: null,
  };
}

function fixture(): HabitTargetAdherenceWindow {
  return {
    period: 'week',
    windowStart: '2026-09-21',
    windowEnd: '2026-09-27',
    today: '2026-09-24',
    configurationState: 'partially_configured',
    metricState: 'result',
    expectedHabitDays: 1,
    completedExpectedHabitDays: 1,
    extraRecordedHabitDays: 0,
    adherencePercent: 100,
    perHabit: {
      hydration: zeroHabit(),
      walk: {
        configurationState: 'configured',
        metricState: 'result',
        expectedHabitDays: 1,
        completedExpectedHabitDays: 1,
        extraRecordedHabitDays: 0,
        adherencePercent: 100,
      },
      mobility: zeroHabit(),
      sleep: zeroHabit(),
    },
    days: [
      { localDate: '2026-09-21', weekday: 1, isToday: false, isFuture: false, habitStates: notExpectedStates() },
      { localDate: '2026-09-22', weekday: 2, isToday: false, isFuture: false, habitStates: notExpectedStates() },
      { localDate: '2026-09-23', weekday: 3, isToday: false, isFuture: false, habitStates: notExpectedStates() },
      {
        localDate: '2026-09-24',
        weekday: 4,
        isToday: true,
        isFuture: false,
        habitStates: { ...notExpectedStates(), walk: 'expected_completed' },
      },
      { localDate: '2026-09-25', weekday: 5, isToday: false, isFuture: true, habitStates: notExpectedStates() },
      { localDate: '2026-09-26', weekday: 6, isToday: false, isFuture: true, habitStates: notExpectedStates() },
      { localDate: '2026-09-27', weekday: 0, isToday: false, isFuture: true, habitStates: notExpectedStates() },
    ],
  };
}

function notExpectedStates(): Record<HabitKey, HabitTargetDayState> {
  return {
    hydration: 'not_expected',
    walk: 'not_expected',
    mobility: 'not_expected',
    sleep: 'not_expected',
  };
}

function broken(mutate: (window: Record<string, unknown>) => void): unknown {
  const window = JSON.parse(JSON.stringify(fixture())) as Record<string, unknown>;
  mutate(window);
  return window;
}

const GENERIC_MESSAGE = 'No se pudo cargar tu cumplimiento de hábitos';

describe('habit-adherence client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses a valid window for each accepted period', async () => {
    const window = fixture();
    global.fetch = jest.fn(async () => jsonResponse(window)) as unknown as typeof fetch;

    await expect(fetchHabitTargetAdherence('week')).resolves.toEqual(window);
  });

  it.each(['week', 'month', 'quarter'] as const)(
    'requests the %s window from the adherence endpoint',
    async (period) => {
      global.fetch = jest.fn(async () =>
        jsonResponse({ ...fixture(), period }),
      ) as unknown as typeof fetch;

      await fetchHabitTargetAdherence(period);

      expect(global.fetch).toHaveBeenCalledWith(`/api/stats/habit-adherence?period=${period}`);
    },
  );

  it.each<[string, (window: Record<string, unknown>) => void]>([
    [
      'an unknown perHabit key',
      (window) => {
        (window.perHabit as Record<string, unknown>).cardio = zeroHabit();
      },
    ],
    [
      'a missing catalog key in perHabit',
      (window) => {
        delete (window.perHabit as Record<string, unknown>).sleep;
      },
    ],
    [
      'an unknown habit key in a day',
      (window) => {
        const days = window.days as Array<Record<string, unknown>>;
        (days[0].habitStates as Record<string, unknown>).cardio = 'not_expected';
      },
    ],
    ['an impossible calendar date', (window) => {
      window.windowStart = '2026-02-31';
    }],
    ['a window ending before it starts', (window) => {
      window.windowStart = '2026-09-28';
    }],
    ['a today outside the window', (window) => {
      window.today = '2026-10-01';
    }],
    ['an unsupported period', (window) => {
      window.period = 'year';
    }],
    [
      'a negative count',
      (window) => {
        window.expectedHabitDays = -1;
      },
    ],
    [
      'a fractional count',
      (window) => {
        window.expectedHabitDays = 1.5;
      },
    ],
    [
      'a completed count above the denominator',
      (window) => {
        (((window.perHabit as Record<string, unknown>).walk as Record<string, unknown>).completedExpectedHabitDays = 2);
      },
    ],
    [
      'a global percentage that does not match the counts',
      (window) => {
        window.adherencePercent = 99;
      },
    ],
    [
      'a per-habit percentage that does not match the counts',
      (window) => {
        (((window.perHabit as Record<string, unknown>).walk as Record<string, unknown>).adherencePercent = 50);
      },
    ],
    [
      'a non-null percentage with a zero denominator',
      (window) => {
        (((window.perHabit as Record<string, unknown>).walk as Record<string, unknown>).expectedHabitDays = 0);
        (((window.perHabit as Record<string, unknown>).walk as Record<string, unknown>).completedExpectedHabitDays = 0);
        (((window.perHabit as Record<string, unknown>).walk as Record<string, unknown>).adherencePercent = 0);
      },
    ],
    [
      'a null percentage with a positive denominator',
      (window) => {
        (((window.perHabit as Record<string, unknown>).walk as Record<string, unknown>).adherencePercent = null);
      },
    ],
    [
      'an unknown per-habit metric state',
      (window) => {
        (((window.perHabit as Record<string, unknown>).walk as Record<string, unknown>).metricState = 'partial');
      },
    ],
    [
      'an unknown global configuration state',
      (window) => {
        window.configurationState = 'partial';
      },
    ],
    [
      'an unknown daily state',
      (window) => {
        const days = window.days as Array<Record<string, unknown>>;
        (days[0].habitStates as Record<string, unknown>).walk = 'failed';
      },
    ],
    [
      'a global configuration state that is not derivable from perHabit',
      (window) => {
        window.configurationState = 'configured';
      },
    ],
    [
      'aggregates that do not equal the sum of perHabit',
      (window) => {
        window.expectedHabitDays = 2;
        window.completedExpectedHabitDays = 2;
        window.adherencePercent = 100;
      },
    ],
    [
      'a non-contiguous day list',
      (window) => {
        (window.days as unknown[]).splice(1, 1);
      },
    ],
    [
      'a day list that does not end on windowEnd',
      (window) => {
        (window.days as unknown[]).pop();
      },
    ],
    [
      'a day whose weekday does not match its date',
      (window) => {
        const days = window.days as Array<Record<string, unknown>>;
        days[0].weekday = 6;
      },
    ],
    [
      'a day whose isFuture flag contradicts its date',
      (window) => {
        const days = window.days as Array<Record<string, unknown>>;
        days[6].isFuture = false;
      },
    ],
  ])('rejects a window with %s', async (_label, mutate) => {
    global.fetch = jest.fn(async () => jsonResponse(broken(mutate))) as unknown as typeof fetch;

    await expect(fetchHabitTargetAdherence('week')).rejects.toMatchObject({
      name: 'HabitTargetAdherenceClientError',
      kind: 'generic',
      message: GENERIC_MESSAGE,
    });
  });

  it('rejects a non-object payload and an empty body', async () => {
    global.fetch = jest.fn(async () => jsonResponse([])) as unknown as typeof fetch;
    await expect(fetchHabitTargetAdherence('week')).rejects.toMatchObject({ kind: 'generic' });

    global.fetch = jest.fn(async () => textResponse('', 200)) as unknown as typeof fetch;
    await expect(fetchHabitTargetAdherence('week')).rejects.toMatchObject({ kind: 'generic' });
  });

  it('maps 401 responses to an unauthorized client error carrying the API body', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'UNAUTHORIZED', message: 'Autenticación requerida' }, 401),
    ) as unknown as typeof fetch;

    await expect(fetchHabitTargetAdherence('week')).rejects.toMatchObject({
      name: 'HabitTargetAdherenceClientError',
      kind: 'unauthorized',
      status: 401,
      api: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
    });
  });

  it('maps 400 responses to a validation client error', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'VALIDATION', message: 'Período de cumplimiento de hábitos inválido' }, 400),
    ) as unknown as typeof fetch;

    await expect(fetchHabitTargetAdherence('week')).rejects.toMatchObject({
      kind: 'validation',
      status: 400,
    });
  });

  it('maps an unreadable error body to a generic client error', async () => {
    global.fetch = jest.fn(async () => textResponse('<html>502</html>', 502)) as unknown as typeof fetch;

    await expect(fetchHabitTargetAdherence('week')).rejects.toMatchObject({
      kind: 'generic',
      status: 502,
      api: null,
      message: GENERIC_MESSAGE,
    });
  });

  it('preserves the client error type and message for callers', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ nope: true })) as unknown as typeof fetch;

    const error = await fetchHabitTargetAdherence('week').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HabitTargetAdherenceClientError);
    expect(error).toBeInstanceOf(Error);
    expect((error as HabitTargetAdherenceClientError).message).toBe(GENERIC_MESSAGE);
  });
});
