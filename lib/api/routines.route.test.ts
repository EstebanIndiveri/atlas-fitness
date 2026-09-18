/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/routines/route';
import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import {
  sessions,
  botMessages,
  dailyCheckins,
  exercises,
  routineExercises,
  routines,
  streakNudges,
  telegramLinkCodes,
  users,
  userStreaks,
  workouts,
  workoutSets,
} from '@/lib/db/schema';

async function authenticatedRequest(userId: number): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest('http://localhost:3000/api/routines', {
    method: 'GET',
    headers: { cookie },
  });
}

describe('GET /api/routines', () => {
  let userId: number;

  beforeEach(async () => {
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(routineExercises);
    await db.delete(routines);
    await db.delete(dailyCheckins);
    await db.delete(streakNudges);
    await db.delete(userStreaks);
    await db.delete(botMessages);
    await db.delete(telegramLinkCodes);
    await db.delete(exercises);
    await db.delete(sessions);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({ name: 'Routines API', email: 'routines-api@test.com', passwordHash: 'hash' })
      .returning();
    userId = user.id;

    const [bench] = await db
      .insert(exercises)
      .values({
        slug: 'bench-press',
        name: 'Press Banca',
        muscleGroup: 'Pecho',
        instructions: 'x',
        isSystem: true,
      })
      .returning();

    const [routine] = await db
      .insert(routines)
      .values({
        slug: 'full-body-expres',
        name: 'Full body exprés',
        kind: 'gym',
        restSeconds: 45,
        isSystem: true,
      })
      .returning();

    await db.insert(routineExercises).values({
      routineId: routine.id,
      exerciseId: bench.id,
      sortOrder: 1,
      targetSets: 1,
      targetReps: 5,
    });
  });

  it('returns 200 with seeded routines for an authenticated user', async () => {
    const response = await GET(await authenticatedRequest(userId));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { name: string; exercises: unknown[] }[];
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Full body exprés');
    expect(body[0].exercises).toHaveLength(1);
  });

  it('returns 401 without a session', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/routines'));
    expect(response.status).toBe(401);
  });
});
