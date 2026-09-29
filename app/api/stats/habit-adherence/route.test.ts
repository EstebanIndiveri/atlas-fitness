/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { GET } from './route';
import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import { habitLogs, habitTargetDays, habitTargetSchedules, sessions, users } from '@/lib/db/schema';
import type { HabitKey } from '@/types/habit';
import type { HabitTargetAdherenceWindow } from '@/types/habit-adherence';
import type { HabitTargetDayState, HabitTargetWeekday } from '@/types/habit-target';

// 2026-09-24T15:00:00Z is 2026-09-24 12:00 in Córdoba: a Thursday, so the current
// Monday-first week is 2026-09-21 … 2026-09-27 and Sunday-first weekdays are 1..6,0.
const TODAY = new Date('2026-09-24T15:00:00.000Z');
const MONTH_START = '2026-08-26';
const QUARTER_START = '2026-06-27';

const WEEK_DAYS: ReadonlyArray<{
  localDate: string;
  weekday: HabitTargetWeekday;
  isToday: boolean;
  isFuture: boolean;
}> = [
  { localDate: '2026-09-21', weekday: 1, isToday: false, isFuture: false },
  { localDate: '2026-09-22', weekday: 2, isToday: false, isFuture: false },
  { localDate: '2026-09-23', weekday: 3, isToday: false, isFuture: false },
  { localDate: '2026-09-24', weekday: 4, isToday: true, isFuture: false },
  { localDate: '2026-09-25', weekday: 5, isToday: false, isFuture: true },
  { localDate: '2026-09-26', weekday: 6, isToday: false, isFuture: true },
  { localDate: '2026-09-27', weekday: 0, isToday: false, isFuture: true },
];

function allNotExpectedStates(): Record<HabitKey, HabitTargetDayState> {
  return {
    hydration: 'not_expected',
    walk: 'not_expected',
    mobility: 'not_expected',
    sleep: 'not_expected',
  };
}

function notConfiguredHabit() {
  return {
    configurationState: 'not_configured' as const,
    metricState: 'no_expected_days' as const,
    expectedHabitDays: 0,
    completedExpectedHabitDays: 0,
    extraRecordedHabitDays: 0,
    adherencePercent: null,
  };
}

const EMPTY_WEEK = {
  period: 'week' as const,
  windowStart: '2026-09-21',
  windowEnd: '2026-09-27',
  today: '2026-09-24',
  configurationState: 'not_configured' as const,
  metricState: 'no_expected_days' as const,
  expectedHabitDays: 0,
  completedExpectedHabitDays: 0,
  extraRecordedHabitDays: 0,
  adherencePercent: null,
  perHabit: {
    hydration: notConfiguredHabit(),
    walk: notConfiguredHabit(),
    mobility: notConfiguredHabit(),
    sleep: notConfiguredHabit(),
  },
  days: WEEK_DAYS.map((day) => ({ ...day, habitStates: allNotExpectedStates() })),
};

function adherenceUrl(params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return `http://localhost:3000/api/stats/habit-adherence${query ? `?${query}` : ''}`;
}

async function authenticatedRequest(
  userId: number,
  params: Record<string, string> = {},
): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest(adherenceUrl(params), { method: 'GET', headers: { cookie } });
}

function unauthenticatedRequest(params: Record<string, string> = {}): NextRequest {
  return new NextRequest(adherenceUrl(params), { method: 'GET' });
}

async function insertUser(email: string): Promise<number> {
  const [user] = await db
    .insert(users)
    .values({ name: 'Habit Adherence Route User', email, passwordHash: 'hash' })
    .returning();

  return user.id;
}

async function insertSchedule(
  userId: number,
  habitKey: HabitKey,
  effectiveFrom: string,
  effectiveTo: string | null,
  weekdays: HabitTargetWeekday[],
): Promise<void> {
  const [schedule] = await db
    .insert(habitTargetSchedules)
    .values({
      userId,
      habitKey,
      effectiveFrom,
      effectiveTo,
      version: 1,
      createdAt: TODAY,
      updatedAt: TODAY,
    })
    .returning();

  await db
    .insert(habitTargetDays)
    .values(weekdays.map((dayOfWeek) => ({ scheduleId: schedule.id, dayOfWeek })));
}

async function insertLog(
  userId: number,
  localDate: string,
  habitKey: HabitKey,
  done = true,
): Promise<void> {
  await db.insert(habitLogs).values({ userId, localDate, habitKey, done });
}

async function readWindow(response: Response): Promise<HabitTargetAdherenceWindow> {
  return (await response.json()) as HabitTargetAdherenceWindow;
}

describe('/api/stats/habit-adherence', () => {
  let userId: number;
  let otherId: number;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(TODAY);

    await db.delete(habitTargetDays);
    await db.delete(habitTargetSchedules);
    await db.delete(habitLogs);
    await db.delete(sessions);
    await db.delete(users);

    userId = await insertUser('habit-adherence-route@test.com');
    otherId = await insertUser('habit-adherence-route-other@test.com');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 401 UNAUTHORIZED without a session', async () => {
    const response = await GET(unauthenticatedRequest({ period: 'week' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it.each(['year', 'semester', 'all', 'WEEK', 'week ', 'month,quarter', ''])(
    'returns 400 VALIDATION for the unusable period %p',
    async (period) => {
      const response = await GET(await authenticatedRequest(userId, { period }));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        code: 'VALIDATION',
        message: 'Período de cumplimiento de hábitos inválido',
      });
    },
  );

  it('returns the exact empty window when the catalog has no target and no log', async () => {
    const response = await GET(await authenticatedRequest(userId, { period: 'week' }));

    expect(response.status).toBe(200);
    await expect(readWindow(response)).resolves.toEqual(EMPTY_WEEK);
  });

  it('defaults to the week window when period is omitted', async () => {
    const response = await GET(await authenticatedRequest(userId));

    await expect(readWindow(response)).resolves.toEqual(EMPTY_WEEK);
  });

  it('counts an expected day completed: N de M and its ratio', async () => {
    await insertSchedule(userId, 'walk', '2026-09-24', null, [4]);
    await insertLog(userId, '2026-09-24', 'walk');

    const response = await GET(await authenticatedRequest(userId, { period: 'week' }));
    const body = await readWindow(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      period: 'week',
      configurationState: 'partially_configured',
      metricState: 'result',
      expectedHabitDays: 1,
      completedExpectedHabitDays: 1,
      extraRecordedHabitDays: 0,
      adherencePercent: 100,
    });
    expect(body.perHabit.walk).toEqual({
      configurationState: 'configured',
      metricState: 'result',
      expectedHabitDays: 1,
      completedExpectedHabitDays: 1,
      extraRecordedHabitDays: 0,
      adherencePercent: 100,
    });
    expect(body.perHabit.hydration).toEqual(notConfiguredHabit());
    const today = body.days.find((day) => day.localDate === '2026-09-24');
    expect(today?.habitStates.walk).toBe('expected_completed');
  });

  it('counts an expected day unrecorded: denominator grows, numerator does not', async () => {
    await insertSchedule(userId, 'walk', '2026-09-21', null, [3]);

    const response = await GET(await authenticatedRequest(userId, { period: 'week' }));
    const body = await readWindow(response);

    expect(body).toMatchObject({
      configurationState: 'partially_configured',
      metricState: 'result',
      expectedHabitDays: 1,
      completedExpectedHabitDays: 0,
      adherencePercent: 0,
    });
    const wednesday = body.days.find((day) => day.localDate === '2026-09-23');
    expect(wednesday?.habitStates.walk).toBe('expected_unrecorded');
  });

  it('books a completion on a non-expected day as extra without moving adherence', async () => {
    await insertSchedule(userId, 'walk', '2026-09-24', null, [4]);
    await insertLog(userId, '2026-09-24', 'hydration');

    const response = await GET(await authenticatedRequest(userId, { period: 'week' }));
    const body = await readWindow(response);

    expect(body).toMatchObject({
      expectedHabitDays: 1,
      completedExpectedHabitDays: 0,
      extraRecordedHabitDays: 1,
      adherencePercent: 0,
    });
    const today = body.days.find((day) => day.localDate === '2026-09-24');
    expect(today?.habitStates.hydration).toBe('extra_recorded');
  });

  it('keeps a scheduled future day out of the denominator as future_expected', async () => {
    await insertSchedule(userId, 'walk', '2026-09-24', null, [6]);

    const response = await GET(await authenticatedRequest(userId, { period: 'week' }));
    const body = await readWindow(response);

    expect(body).toMatchObject({
      configurationState: 'partially_configured',
      metricState: 'no_expected_days',
      expectedHabitDays: 0,
      adherencePercent: null,
    });
    const saturday = body.days.find((day) => day.localDate === '2026-09-26');
    expect(saturday?.isFuture).toBe(true);
    expect(saturday?.habitStates.walk).toBe('future_expected');
  });

  it('keeps an ended schedule historical: not_configured with a result', async () => {
    await insertSchedule(userId, 'walk', '2026-09-21', '2026-09-22', [1, 2]);
    await insertLog(userId, '2026-09-21', 'walk');

    const response = await GET(await authenticatedRequest(userId, { period: 'week' }));
    const body = await readWindow(response);

    expect(body).toMatchObject({
      configurationState: 'not_configured',
      metricState: 'result',
      expectedHabitDays: 2,
      completedExpectedHabitDays: 1,
      adherencePercent: 50,
    });
    expect(body.perHabit.walk).toEqual({
      configurationState: 'not_configured',
      metricState: 'result',
      expectedHabitDays: 2,
      completedExpectedHabitDays: 1,
      extraRecordedHabitDays: 0,
      adherencePercent: 50,
    });
  });

  it('reports partial configuration with independent per-habit metric states', async () => {
    await insertSchedule(userId, 'walk', '2026-09-21', null, [1]);
    await insertSchedule(userId, 'hydration', '2026-09-24', null, [4]);
    await insertLog(userId, '2026-09-24', 'hydration');

    const response = await GET(await authenticatedRequest(userId, { period: 'week' }));
    const body = await readWindow(response);

    expect(body.configurationState).toBe('partially_configured');
    expect(body.perHabit.walk.configurationState).toBe('configured');
    expect(body.perHabit.hydration.configurationState).toBe('configured');
    expect(body.perHabit.mobility.configurationState).toBe('not_configured');
    expect(body.perHabit.walk.metricState).toBe('result');
    expect(body.perHabit.mobility.metricState).toBe('no_expected_days');
  });

  it('serves the month and quarter windows with their exact bounds', async () => {
    const month = await readWindow(
      await GET(await authenticatedRequest(userId, { period: 'month' })),
    );
    expect(month.windowStart).toBe(MONTH_START);
    expect(month.windowEnd).toBe('2026-09-24');
    expect(month.days).toHaveLength(30);

    const quarter = await readWindow(
      await GET(await authenticatedRequest(userId, { period: 'quarter' })),
    );
    expect(quarter.windowStart).toBe(QUARTER_START);
    expect(quarter.windowEnd).toBe('2026-09-24');
    expect(quarter.days).toHaveLength(90);
  });

  it('scopes strictly to the session user (cross-user isolation)', async () => {
    await insertSchedule(userId, 'walk', '2026-09-24', null, [4]);
    await insertLog(userId, '2026-09-24', 'walk');

    const response = await GET(await authenticatedRequest(otherId, { period: 'week' }));

    expect(response.status).toBe(200);
    const body = await readWindow(response);
    expect(body.expectedHabitDays).toBe(0);
    expect(body.metricState).toBe('no_expected_days');
    expect(body.configurationState).toBe('not_configured');
  });

  it('is read-only: repeated reads keep the same window and store nothing', async () => {
    await insertSchedule(userId, 'walk', '2026-09-24', null, [4]);
    await insertLog(userId, '2026-09-24', 'walk');
    const schedulesBefore = await db.select().from(habitTargetSchedules);

    const first = await GET(await authenticatedRequest(userId, { period: 'week' }));
    const second = await GET(await authenticatedRequest(userId, { period: 'week' }));

    await expect(readWindow(second)).resolves.toEqual(await readWindow(first));
    await expect(db.select().from(habitTargetSchedules)).resolves.toHaveLength(
      schedulesBefore.length,
    );
  });
});
