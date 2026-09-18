/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/workouts/route';
import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import * as workoutsService from '@/lib/services/workouts';
import { db } from '@/lib/db/client';
import {
  sessions,
  users,
  workouts,
  workoutSets,
  userStreaks,
  telegramLinkCodes,
  dailyCheckins,
  streakNudges,
  botMessages,
  routines,
  routineExercises,
} from '@/lib/db/schema';

async function authenticatedRequest(userId: number, body?: unknown): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest('http://localhost:3000/api/workouts', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('POST /api/workouts', () => {
  let testUserId: number;

  beforeEach(async () => {
    await db.delete(dailyCheckins);
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(streakNudges);
    await db.delete(userStreaks);
    await db.delete(botMessages);
    await db.delete(telegramLinkCodes);
    await db.delete(routineExercises);
    await db.delete(routines);
    await db.delete(sessions);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({
        name: 'Workouts Route User',
        email: 'workouts-route@test.com',
        passwordHash: 'hash',
      })
      .returning();
    testUserId = user.id;
  });

  it('creates a workout with HTTP 201', async () => {
    const response = await POST(await authenticatedRequest(testUserId, {}));
    const body = (await response.json()) as { id: number; endedAt: string | null };

    expect(response.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.endedAt).toBeNull();
  });

  it('returns 400 VALIDATION for an invalid routineId body', async () => {
    const response = await POST(await authenticatedRequest(testUserId, { routineId: 'nope' }));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION');
  });

  it('returns 400 VALIDATION when routineId does not exist', async () => {
    const response = await POST(await authenticatedRequest(testUserId, { routineId: 99999 }));
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION');
    expect(body.message).toBe('Rutina no válida');
  });

  it('returns 409 CONFLICT when an active workout already exists', async () => {
    await workoutsService.createWorkout(testUserId);

    const response = await POST(await authenticatedRequest(testUserId, {}));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe('CONFLICT');
  });
});
