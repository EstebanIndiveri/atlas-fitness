/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/workouts/active/route';
import { encodeSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import * as workoutsService from '@/lib/services/workouts';
import { db } from '@/lib/db/client';
import {
  users,
  workouts,
  workoutSets,
  userStreaks,
  telegramLinkCodes,
  dailyCheckins,
  streakNudges,
  botMessages,
} from '@/lib/db/schema';

function authenticatedRequest(userId: number): NextRequest {
  const cookie = `${SESSION_COOKIE_NAME}=${encodeSession({ userId })}`;
  return new NextRequest('http://localhost:3000/api/workouts/active', {
    method: 'GET',
    headers: { cookie },
  });
}

function unauthenticatedRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/workouts/active', {
    method: 'GET',
  });
}

describe('GET /api/workouts/active', () => {
  let testUserId: number;

  beforeEach(async () => {
    await db.delete(dailyCheckins);
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(streakNudges);
    await db.delete(userStreaks);
    await db.delete(botMessages);
    await db.delete(telegramLinkCodes);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({
        name: 'Active Route User',
        email: 'active-route@test.com',
        passwordHash: 'hash',
      })
      .returning();
    testUserId = user.id;
  });

  it('returns HTTP 200 with JSON null when there is no active workout', async () => {
    const response = await GET(authenticatedRequest(testUserId));

    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it('returns HTTP 200 with workout JSON when an active workout exists', async () => {
    const workout = await workoutsService.createWorkout(testUserId);

    const response = await GET(authenticatedRequest(testUserId));
    const body = (await response.json()) as { id: number; endedAt: string | null };

    expect(response.status).toBe(200);
    expect(body).not.toBeNull();
    expect(body.id).toBe(workout.id);
    expect(body.endedAt).toBeNull();
  });

  it('returns 401 UNAUTHORIZED without a session', async () => {
    const response = await GET(unauthenticatedRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });
});
