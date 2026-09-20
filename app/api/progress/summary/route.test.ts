/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import {
  botMessages,
  dailyCheckins,
  habitLogs,
  sessions,
  streakNudges,
  telegramLinkCodes,
  userStreaks,
  users,
  workouts,
  workoutSets,
} from '@/lib/db/schema';

import { GET } from './route';

async function authenticatedRequest(userId: number, period?: string): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  const url = period
    ? `http://localhost:3000/api/progress/summary?period=${period}`
    : 'http://localhost:3000/api/progress/summary';
  return new NextRequest(url, { method: 'GET', headers: { cookie } });
}

describe('/api/progress/summary', () => {
  let userId: number;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-24T15:00:00.000Z'));

    await db.delete(habitLogs);
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
      .values({ name: 'Progress Route User', email: 'progress-route@test.com', passwordHash: 'hash' })
      .returning();
    userId = user.id;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns HTTP 200 with a progress summary and defaults to month', async () => {
    const response = await GET(await authenticatedRequest(userId));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      period: 'month',
      fromLocalDate: '2026-08-26',
      toLocalDate: '2026-09-24',
      completedSessions: 0,
      totalDurationMinutes: 0,
      sessions: [],
    });
  });

  it('returns HTTP 400 for an invalid period', async () => {
    const response = await GET(await authenticatedRequest(userId, 'year'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION' });
  });

  it('returns HTTP 401 without a valid session', async () => {
    const response = await GET(
      new NextRequest('http://localhost:3000/api/progress/summary', { method: 'GET' }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
