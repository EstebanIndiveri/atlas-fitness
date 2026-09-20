/**
 * @jest-environment node
 */
import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { GET } from './route';
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
import { createTrainingPlan } from '@/lib/services/training-plan';

const TODAY = new Date('2026-09-19T15:00:00.000Z');

async function authenticatedRequest(userId: number): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest('http://localhost:3000/api/today', {
    method: 'GET',
    headers: { cookie },
  });
}

function unauthenticatedRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/today', { method: 'GET' });
}

describe('GET /api/today', () => {
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
        name: 'Today Route User',
        email: 'today-route@test.com',
        passwordHash: 'hash',
      })
      .returning();
    userId = user.id;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns HTTP 200 with no_plan when the user has no active plan', async () => {
    const response = await GET(await authenticatedRequest(userId));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      kind: 'no_plan',
      localDate: '2026-09-19',
      dayOfWeek: 6,
    });
  });

  it('returns HTTP 200 with rest_day when no routine is scheduled today', async () => {
    const routineId = await createRoutine('Domingo');
    await createTrainingPlan({
      userId,
      name: 'Plan con descanso',
      schedule: [{ dayOfWeek: 0, routineId }],
    });

    const response = await GET(await authenticatedRequest(userId));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      kind: 'rest_day',
      localDate: '2026-09-19',
      dayOfWeek: 6,
      trainingPlanId: expect.any(Number),
    });
  });

  it('returns HTTP 200 with workout when a routine is scheduled today', async () => {
    const routineId = await createRoutine('Sábado fuerza');
    await createTrainingPlan({
      userId,
      name: 'Plan sábado',
      schedule: [{ dayOfWeek: 6, routineId }],
    });

    const response = await GET(await authenticatedRequest(userId));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      kind: 'workout',
      localDate: '2026-09-19',
      dayOfWeek: 6,
      trainingPlanId: expect.any(Number),
      scheduledRoutineId: expect.any(Number),
      routineId,
      routineName: 'Sábado fuerza',
    });
  });

  it('returns HTTP 200 with routine_missing when the scheduled routine is unavailable', async () => {
    const routineId = await createRoutine('Sábado borrado');
    await createTrainingPlan({
      userId,
      name: 'Plan incompleto',
      schedule: [{ dayOfWeek: 6, routineId }],
    });
    await db.update(routines).set({ deletedAt: new Date() }).where(eq(routines.id, routineId));

    const response = await GET(await authenticatedRequest(userId));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      kind: 'routine_missing',
      localDate: '2026-09-19',
      dayOfWeek: 6,
      trainingPlanId: expect.any(Number),
      scheduledRoutineId: expect.any(Number),
      routineId,
    });
  });

  it('returns 401 UNAUTHORIZED without a session', async () => {
    const response = await GET(unauthenticatedRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  async function createRoutine(name: string): Promise<number> {
    const [routine] = await db
      .insert(routines)
      .values({
        slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        name,
        kind: 'gym',
        restSeconds: 90,
        isSystem: false,
        userId,
      })
      .returning();

    return routine.id;
  }
});
