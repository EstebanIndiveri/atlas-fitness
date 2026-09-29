/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { GET } from './route';
import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import { habitTargetDays, habitTargetSchedules, sessions, users } from '@/lib/db/schema';
import { putHabitTarget } from '@/lib/services/habit-targets';

// 2026-09-24T15:00:00Z is 2026-09-24 12:00 in Córdoba: a Thursday (Sunday-first weekday 4).
const TODAY = new Date('2026-09-24T15:00:00.000Z');
const TODAY_LOCAL_DATE = '2026-09-24';

const CREATE = { expectedTargetId: null, expectedVersion: null } as const;

async function authenticatedRequest(userId: number): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest('http://localhost:3000/api/habit-targets', {
    method: 'GET',
    headers: { cookie },
  });
}

function unauthenticatedRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/habit-targets', { method: 'GET' });
}

async function insertUser(email: string): Promise<number> {
  const [user] = await db
    .insert(users)
    .values({ name: 'Habit Target Route User', email, passwordHash: 'hash' })
    .returning();

  return user.id;
}

describe('/api/habit-targets GET', () => {
  let userId: number;
  let otherId: number;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(TODAY);

    await db.delete(habitTargetDays);
    await db.delete(habitTargetSchedules);
    await db.delete(sessions);
    await db.delete(users);

    userId = await insertUser('habit-targets-route@test.com');
    otherId = await insertUser('habit-targets-route-other@test.com');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 401 UNAUTHORIZED without a session', async () => {
    const response = await GET(unauthenticatedRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns 200 with an empty list for a fresh user', async () => {
    const response = await GET(await authenticatedRequest(userId));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it('returns the exact serialized current target shape', async () => {
    await putHabitTarget(userId, 'walk', { weekdays: [3, 1], ...CREATE }, TODAY);

    const response = await GET(await authenticatedRequest(userId));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: expect.any(Number),
        userId,
        habitKey: 'walk',
        effectiveFrom: TODAY_LOCAL_DATE,
        effectiveTo: null,
        version: 1,
        weekdays: [1, 3],
        createdAt: TODAY.toISOString(),
        updatedAt: TODAY.toISOString(),
      },
    ]);
  });

  it('lists only configured habits, in catalog order', async () => {
    await putHabitTarget(userId, 'sleep', { weekdays: [0], ...CREATE }, TODAY);
    await putHabitTarget(userId, 'hydration', { weekdays: [1], ...CREATE }, TODAY);
    await putHabitTarget(userId, 'walk', { weekdays: [2, 4], ...CREATE }, TODAY);

    const response = await GET(await authenticatedRequest(userId));
    const body = (await response.json()) as Array<{ habitKey: string; weekdays: number[] }>;

    expect(body.map((target) => target.habitKey)).toEqual(['hydration', 'walk', 'sleep']);
    expect(body.every((target) => target.weekdays.length >= 1)).toBe(true);
  });

  it('scopes strictly to the session user (cross-user isolation)', async () => {
    await putHabitTarget(userId, 'walk', { weekdays: [1], ...CREATE }, TODAY);

    const otherResponse = await GET(await authenticatedRequest(otherId));

    expect(otherResponse.status).toBe(200);
    await expect(otherResponse.json()).resolves.toEqual([]);
  });

  it('is read-only: repeated reads never create or change targets', async () => {
    await putHabitTarget(userId, 'walk', { weekdays: [1], ...CREATE }, TODAY);
    const before = await db.select().from(habitTargetSchedules);

    const first = await GET(await authenticatedRequest(userId));
    const second = await GET(await authenticatedRequest(userId));

    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual(await first.json());
    await expect(db.select().from(habitTargetSchedules)).resolves.toHaveLength(before.length);
  });
});
