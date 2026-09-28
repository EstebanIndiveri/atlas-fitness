/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { GET } from './route';
import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import { habitLogs, sessions, users } from '@/lib/db/schema';
import type { HabitActivityWindow } from '@/types/habit-activity';
import type { HabitKey } from '@/types/habit';

const TODAY = new Date('2026-09-24T15:00:00.000Z');

/** Thursday 2026-09-24, so the current Córdoba week is 2026-09-21 … 2026-09-27. */
const RECORDED_HABITS_BY_DATE: Record<string, HabitKey[]> = {
  '2026-09-22': ['hydration', 'walk'],
  '2026-09-24': ['mobility'],
};

const EXPECTED_WEEK: HabitActivityWindow = {
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

const ACCEPTED_PERIODS = ['week', 'month', 'quarter'] as const;
const MAX_WINDOW_DAYS = 90;

function habitsUrl(params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return `http://localhost:3000/api/stats/habits${query ? `?${query}` : ''}`;
}

async function authenticatedRequest(
  userId: number,
  params: Record<string, string> = {},
): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest(habitsUrl(params), { method: 'GET', headers: { cookie } });
}

function unauthenticatedRequest(params: Record<string, string> = {}): NextRequest {
  return new NextRequest(habitsUrl(params), { method: 'GET' });
}

async function insertUser(email: string): Promise<number> {
  const [user] = await db
    .insert(users)
    .values({ name: 'Habit Activity User', email, passwordHash: 'hash' })
    .returning();

  return user.id;
}

async function seedRecordedHabits(userId: number): Promise<void> {
  for (const [localDate, habitKeys] of Object.entries(RECORDED_HABITS_BY_DATE)) {
    for (const habitKey of habitKeys) {
      await db.insert(habitLogs).values({ userId, localDate, habitKey, done: true });
    }
  }
}

async function readWindow(response: Response): Promise<HabitActivityWindow> {
  return (await response.json()) as HabitActivityWindow;
}

describe('/api/stats/habits', () => {
  let userId: number;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(TODAY);

    await db.delete(habitLogs);
    await db.delete(sessions);
    await db.delete(users);

    userId = await insertUser('habit-activity-route@test.com');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns HTTP 200 with the exact HabitActivityWindow contract for the week', async () => {
    await seedRecordedHabits(userId);

    const response = await GET(await authenticatedRequest(userId, { period: 'week' }));

    expect(response.status).toBe(200);
    await expect(readWindow(response)).resolves.toEqual(EXPECTED_WEEK);
  });

  it('defaults to the week window when period is omitted', async () => {
    await seedRecordedHabits(userId);

    const response = await GET(await authenticatedRequest(userId));

    expect(response.status).toBe(200);
    await expect(readWindow(response)).resolves.toEqual(EXPECTED_WEEK);
  });

  it('serves the 30-day month window and echoes insightStatus="available" verbatim', async () => {
    await seedRecordedHabits(userId);

    const response = await GET(await authenticatedRequest(userId, { period: 'month' }));

    expect(response.status).toBe(200);
    const body = await readWindow(response);
    expect(body.period).toBe('month');
    expect(body.windowStart).toBe('2026-08-26');
    expect(body.windowEnd).toBe('2026-09-24');
    expect(body.days).toHaveLength(30);
    expect(body.elapsedDays).toBe(30);
    expect(body.activeDays).toBe(2);
    expect(body.insightStatus).toBe('available');
    expect(body.insightMinimumElapsedDays).toBe(7);
  });

  it('serves the 90-day quarter window', async () => {
    const response = await GET(await authenticatedRequest(userId, { period: 'quarter' }));

    expect(response.status).toBe(200);
    const body = await readWindow(response);
    expect(body.windowStart).toBe('2026-06-27');
    expect(body.windowEnd).toBe('2026-09-24');
    expect(body.days).toHaveLength(MAX_WINDOW_DAYS);
    expect(body.elapsedDays).toBe(MAX_WINDOW_DAYS);
  });

  it('never serves a window longer than 90 days, whatever the accepted period', async () => {
    for (const period of ACCEPTED_PERIODS) {
      const response = await GET(await authenticatedRequest(userId, { period }));
      const body = await readWindow(response);

      expect(response.status).toBe(200);
      expect(body.days.length).toBeLessThanOrEqual(MAX_WINDOW_DAYS);
      expect(body.days[body.days.length - 1].localDate).toBe(body.windowEnd);
    }
  });

  it('returns a truthful empty window when nothing is recorded', async () => {
    const response = await GET(await authenticatedRequest(userId, { period: 'week' }));

    expect(response.status).toBe(200);
    const body = await readWindow(response);
    expect(body.activeDays).toBe(0);
    expect(body.elapsedDays).toBe(4);
    expect(body.perHabit).toEqual({
      hydration: { activeDays: 0 },
      walk: { activeDays: 0 },
      mobility: { activeDays: 0 },
      sleep: { activeDays: 0 },
    });
    expect(body.days.every((day) => !day.isRecorded && day.recordedKeys.length === 0)).toBe(true);
    expect(body.insightStatus).toBe('insufficient');
  });

  it.each(['year', 'semester', 'all', 'WEEK', 'week ', 'month,quarter', ''])(
    'returns HTTP 400 VALIDATION for the unusable period %p',
    async (period) => {
      const response = await GET(await authenticatedRequest(userId, { period }));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION' });
    },
  );

  it('returns 401 UNAUTHORIZED without a session', async () => {
    const response = await GET(unauthenticatedRequest({ period: 'week' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('ignores a userId supplied in the query string and scopes to the session', async () => {
    const otherUserId = await insertUser('habit-activity-other@test.com');
    await seedRecordedHabits(userId);

    const otherResponse = await GET(
      await authenticatedRequest(otherUserId, { period: 'week', userId: String(userId) }),
    );
    const otherBody = await readWindow(otherResponse);

    expect(otherResponse.status).toBe(200);
    expect(otherBody.activeDays).toBe(0);
    expect(otherBody.days.every((day) => day.recordedKeys.length === 0)).toBe(true);

    const ownerResponse = await GET(
      await authenticatedRequest(userId, { period: 'week', userId: String(otherUserId) }),
    );

    await expect(readWindow(ownerResponse)).resolves.toEqual(EXPECTED_WEEK);
  });

  it('is read-only: repeated reads return the same window and store nothing', async () => {
    await seedRecordedHabits(userId);

    const first = await GET(await authenticatedRequest(userId, { period: 'week' }));
    const second = await GET(await authenticatedRequest(userId, { period: 'week' }));

    expect(second.status).toBe(200);
    await expect(readWindow(second)).resolves.toEqual(await readWindow(first));
    await expect(db.select().from(habitLogs)).resolves.toHaveLength(3);
  });
});
