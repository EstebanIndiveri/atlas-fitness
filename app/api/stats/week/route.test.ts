/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { GET } from './route';
import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import {
  botMessages,
  dailyCheckins,
  sessions,
  streakNudges,
  telegramLinkCodes,
  userStreaks,
  users,
  workouts,
  workoutSets,
} from '@/lib/db/schema';
import { recordDailyCheckIn } from '@/lib/services/daily-checkin';
import type { WeekConsistency } from '@/types/week';

const TODAY = new Date('2026-09-24T15:00:00.000Z');
const TODAY_LOCAL_DATE = '2026-09-24';

async function authenticatedRequest(userId: number): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest('http://localhost:3000/api/stats/week', {
    method: 'GET',
    headers: { cookie },
  });
}

function unauthenticatedRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/stats/week', { method: 'GET' });
}

describe('/api/stats/week', () => {
  let userId: number;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(TODAY);

    await db.delete(streakNudges);
    await db.delete(dailyCheckins);
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(botMessages);
    await db.delete(telegramLinkCodes);
    await db.delete(userStreaks);
    await db.delete(sessions);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({ name: 'Week Route User', email: 'week-route@test.com', passwordHash: 'hash' })
      .returning();
    userId = user.id;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns HTTP 200 with an all-inactive week for a user with no activity', async () => {
    const response = await GET(await authenticatedRequest(userId));

    expect(response.status).toBe(200);
    const body = (await response.json()) as WeekConsistency;
    expect(body.weekStart).toBe('2026-09-21');
    expect(body.weekEnd).toBe('2026-09-27');
    expect(body.days).toHaveLength(7);
    expect(body.activeCount).toBe(0);
  });

  it('marks today active after a daily check-in', async () => {
    await recordDailyCheckIn({ userId, mood: 4, now: TODAY });

    const response = await GET(await authenticatedRequest(userId));

    expect(response.status).toBe(200);
    const body = (await response.json()) as WeekConsistency;
    expect(body.activeCount).toBe(1);
    expect(body.days.find((day) => day.date === TODAY_LOCAL_DATE)?.active).toBe(true);
  });

  it('returns 401 UNAUTHORIZED without a session', async () => {
    const response = await GET(unauthenticatedRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
