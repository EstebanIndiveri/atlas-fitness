/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { GET, POST } from './route';
import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import {
  botMessages,
  dailyCheckins,
  routines,
  routineExercises,
  scheduledRoutines,
  sessions,
  streakNudges,
  telegramLinkCodes,
  trainingPlans,
  users,
  userStreaks,
  workouts,
  workoutSets,
} from '@/lib/db/schema';

const TODAY = new Date('2026-09-19T15:00:00.000Z');

async function authenticatedRequest(
  userId: number,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest('http://localhost:3000/api/checkin', {
    method,
    headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function unauthenticatedRequest(method: 'GET' | 'POST', body?: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/checkin', {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function malformedAuthenticatedPost(userId: number): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest('http://localhost:3000/api/checkin', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: '{"mood":',
  });
}

describe('/api/checkin', () => {
  let userId: number;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(TODAY);

    await db.delete(dailyCheckins);
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(routineExercises);
    await db.delete(scheduledRoutines);
    await db.delete(trainingPlans);
    await db.delete(streakNudges);
    await db.delete(userStreaks);
    await db.delete(botMessages);
    await db.delete(telegramLinkCodes);
    await db.delete(routines);
    await db.delete(sessions);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({
        name: 'Check-in Route User',
        email: 'checkin-route@test.com',
        passwordHash: 'hash',
      })
      .returning();
    userId = user.id;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns HTTP 200 with a full daily check-in', async () => {
    const response = await POST(
      await authenticatedRequest(userId, 'POST', {
        mood: 4,
        energy: 'high',
        note: 'Dormí bien y entrené fuerte.',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: expect.any(Number),
      userId,
      localDate: '2026-09-19',
      mood: 4,
      energy: 'high',
      note: 'Dormí bien y entrené fuerte.',
    });
  });

  it('returns HTTP 200 with null energy and note when the body only has mood', async () => {
    const response = await POST(await authenticatedRequest(userId, 'POST', { mood: 3 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: expect.any(Number),
      userId,
      localDate: '2026-09-19',
      mood: 3,
      energy: null,
      note: null,
    });
  });

  it('returns 400 VALIDATION when mood is outside the service contract', async () => {
    const response = await POST(await authenticatedRequest(userId, 'POST', { mood: 6 }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'Check-in diario inválido',
    });
  });

  it('returns 400 VALIDATION when the JSON body is malformed', async () => {
    const response = await POST(await malformedAuthenticatedPost(userId));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'Check-in diario inválido',
    });
  });

  it('returns today check-in for GET when one exists', async () => {
    await POST(
      await authenticatedRequest(userId, 'POST', {
        mood: 5,
        energy: 'medium',
        note: 'Listo para moverme.',
      }),
    );

    const response = await GET(await authenticatedRequest(userId, 'GET'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: expect.any(Number),
      userId,
      localDate: '2026-09-19',
      mood: 5,
      energy: 'medium',
      note: 'Listo para moverme.',
    });
  });

  it('returns null for GET when today has no check-in', async () => {
    const response = await GET(await authenticatedRequest(userId, 'GET'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toBeNull();
  });

  it('returns 401 UNAUTHORIZED without a session', async () => {
    const response = await GET(unauthenticatedRequest('GET'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns 401 UNAUTHORIZED for POST without a session', async () => {
    const response = await POST(unauthenticatedRequest('POST', { mood: 4 }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
