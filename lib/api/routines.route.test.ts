/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/routines/route';
import { DELETE, GET as GET_ONE, PATCH } from '@/app/api/routines/[id]/route';
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
import type { RoutineSummary } from '@/types/routine';

async function authed(
  userId: number,
  url: string,
  init?: { method?: string; body?: string },
): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest(url, {
    method: init?.method,
    body: init?.body,
    headers: { cookie, 'content-type': 'application/json' },
  });
}

describe('Routines API', () => {
  let userId: number;
  let otherId: number;
  let systemRoutineId: number;
  let benchId: number;
  let squatId: number;
  let ownExerciseId: number;
  let foreignExerciseId: number;

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
    const [other] = await db
      .insert(users)
      .values({ name: 'Other Routines API', email: 'other-routines-api@test.com', passwordHash: 'hash' })
      .returning();
    userId = user.id;
    otherId = other.id;

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
    const [squat] = await db
      .insert(exercises)
      .values({
        slug: 'squat',
        name: 'Sentadilla',
        muscleGroup: 'Piernas',
        instructions: 'x',
        isSystem: true,
      })
      .returning();
    const [ownEx] = await db
      .insert(exercises)
      .values({
        slug: 'owner-curl',
        name: 'Curl propio',
        muscleGroup: 'Biceps',
        instructions: 'x',
        isSystem: false,
        userId,
      })
      .returning();
    const [foreignEx] = await db
      .insert(exercises)
      .values({
        slug: 'foreign-curl',
        name: 'Curl ajeno',
        muscleGroup: 'Biceps',
        instructions: 'x',
        isSystem: false,
        userId: otherId,
      })
      .returning();
    benchId = bench.id;
    squatId = squat.id;
    ownExerciseId = ownEx.id;
    foreignExerciseId = foreignEx.id;

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
    systemRoutineId = routine.id;

    await db.insert(routineExercises).values({
      routineId: routine.id,
      exerciseId: bench.id,
      sortOrder: 1,
      targetSets: 1,
      targetReps: 5,
    });
  });

  it('returns 200 with seeded routines for an authenticated user', async () => {
    const response = await GET(await authed(userId, 'http://localhost:3000/api/routines'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as RoutineSummary[];
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Full body exprés');
    expect(body[0].isSystem).toBe(true);
    expect(body[0].exercises).toHaveLength(1);
    expect(body.every((item) => !('userId' in item))).toBe(true);
  });

  it('returns 401 without a session', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/routines'));
    expect(response.status).toBe(401);
  });

  it('omits foreign custom routines and 404s GET by id', async () => {
    const [foreign] = await db
      .insert(routines)
      .values({
        slug: 'foreign-api',
        name: 'Ajena API',
        kind: 'home',
        restSeconds: 20,
        isSystem: false,
        userId: otherId,
      })
      .returning();

    const listRes = await GET(await authed(userId, 'http://localhost:3000/api/routines'));
    const list = (await listRes.json()) as { slug: string }[];
    expect(list.map((item) => item.slug)).toEqual(['full-body-expres']);

    const oneRes = await GET_ONE(await authed(userId, `http://localhost:3000/api/routines/${foreign.id}`), {
      params: Promise.resolve({ id: String(foreign.id) }),
    });
    expect(oneRes.status).toBe(404);
    await expect(oneRes.json()).resolves.toMatchObject({ code: 'NOT_FOUND' });

    const systemRes = await GET_ONE(
      await authed(userId, `http://localhost:3000/api/routines/${systemRoutineId}`),
      { params: Promise.resolve({ id: String(systemRoutineId) }) },
    );
    expect(systemRes.status).toBe(200);
  });

  it('POST creates own custom and list still shows system + own', async () => {
    const created = await POST(
      await authed(userId, 'http://localhost:3000/api/routines', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Push casa',
          description: 'Custom',
          kind: 'home',
          restSeconds: 60,
          exercises: [
            { exerciseId: benchId, sortOrder: 0, targetSets: 3, targetReps: 10 },
            { exerciseId: ownExerciseId, sortOrder: 1, targetSets: 2, targetReps: 12 },
          ],
        }),
      }),
    );
    expect(created.status).toBe(201);
    const body = (await created.json()) as RoutineSummary;
    expect(body.isSystem).toBe(false);
    expect(body.kind).toBe('home');
    expect(body.exercises).toHaveLength(2);
    expect(body.exercises.map((item) => item.exerciseId)).toEqual([benchId, ownExerciseId]);
    expect(body).not.toHaveProperty('userId');

    const listRes = await GET(await authed(userId, 'http://localhost:3000/api/routines'));
    const list = (await listRes.json()) as RoutineSummary[];
    expect(list.map((item) => item.slug).sort()).toEqual([`push-casa-u${userId}`, 'full-body-expres'].sort());
  });

  it('PATCH updates own custom exercises transactionally', async () => {
    const created = await POST(
      await authed(userId, 'http://localhost:3000/api/routines', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Editable',
          kind: 'gym',
          exercises: [{ exerciseId: benchId, sortOrder: 0, targetSets: 3, targetReps: 8 }],
        }),
      }),
    );
    const createdBody = (await created.json()) as RoutineSummary;

    const patched = await PATCH(
      await authed(userId, `http://localhost:3000/api/routines/${createdBody.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Editable v2',
          restSeconds: 75,
          exercises: [
            { exerciseId: squatId, sortOrder: 0, targetSets: 4, targetReps: 6 },
            { exerciseId: benchId, sortOrder: 1, targetSets: 3, targetReps: 10 },
          ],
        }),
      }),
      { params: Promise.resolve({ id: String(createdBody.id) }) },
    );
    expect(patched.status).toBe(200);
    const updated = (await patched.json()) as RoutineSummary;
    expect(updated.name).toBe('Editable v2');
    expect(updated.restSeconds).toBe(75);
    expect(updated.exercises.map((item) => item.exerciseName)).toEqual(['Sentadilla', 'Press Banca']);
    expect(updated.exercises[0].targetSets).toBe(4);
  });

  it('DELETE soft-deletes own custom', async () => {
    const created = await POST(
      await authed(userId, 'http://localhost:3000/api/routines', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Borrar',
          kind: 'gym',
          exercises: [{ exerciseId: benchId, sortOrder: 0, targetSets: 1, targetReps: 5 }],
        }),
      }),
    );
    const createdBody = (await created.json()) as RoutineSummary;

    const deleted = await DELETE(
      await authed(userId, `http://localhost:3000/api/routines/${createdBody.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: String(createdBody.id) }) },
    );
    expect(deleted.status).toBe(200);

    const oneRes = await GET_ONE(
      await authed(userId, `http://localhost:3000/api/routines/${createdBody.id}`),
      { params: Promise.resolve({ id: String(createdBody.id) }) },
    );
    expect(oneRes.status).toBe(404);

    const listRes = await GET(await authed(userId, 'http://localhost:3000/api/routines'));
    const list = (await listRes.json()) as RoutineSummary[];
    expect(list.map((item) => item.id)).not.toContain(createdBody.id);
  });

  it('rejects system mutate with 403 and foreign mutate with 404', async () => {
    const [foreign] = await db
      .insert(routines)
      .values({
        slug: 'foreign-mutate',
        name: 'Ajena mutate',
        kind: 'home',
        restSeconds: 20,
        isSystem: false,
        userId: otherId,
      })
      .returning();

    const systemPatch = await PATCH(
      await authed(userId, `http://localhost:3000/api/routines/${systemRoutineId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Hack system' }),
      }),
      { params: Promise.resolve({ id: String(systemRoutineId) }) },
    );
    expect(systemPatch.status).toBe(403);
    await expect(systemPatch.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });

    const systemDelete = await DELETE(
      await authed(userId, `http://localhost:3000/api/routines/${systemRoutineId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: String(systemRoutineId) }) },
    );
    expect(systemDelete.status).toBe(403);

    const foreignPatch = await PATCH(
      await authed(userId, `http://localhost:3000/api/routines/${foreign.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Hack ajena' }),
      }),
      { params: Promise.resolve({ id: String(foreign.id) }) },
    );
    expect(foreignPatch.status).toBe(404);
    await expect(foreignPatch.json()).resolves.toMatchObject({ code: 'NOT_FOUND' });

    const foreignDelete = await DELETE(
      await authed(userId, `http://localhost:3000/api/routines/${foreign.id}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: String(foreign.id) }) },
    );
    expect(foreignDelete.status).toBe(404);
  });

  it('rejects empty exercise list and inaccessible exerciseId', async () => {
    const empty = await POST(
      await authed(userId, 'http://localhost:3000/api/routines', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Vacia',
          kind: 'gym',
          exercises: [],
        }),
      }),
    );
    expect(empty.status).toBe(400);
    await expect(empty.json()).resolves.toMatchObject({ code: 'VALIDATION' });

    const missing = await POST(
      await authed(userId, 'http://localhost:3000/api/routines', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Sin ejercicio',
          kind: 'gym',
          exercises: [{ exerciseId: 999999, sortOrder: 0, targetSets: 3, targetReps: 10 }],
        }),
      }),
    );
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Ejercicio no encontrado',
    });

    const foreignEx = await POST(
      await authed(userId, 'http://localhost:3000/api/routines', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Robo ejercicio',
          kind: 'gym',
          exercises: [{ exerciseId: foreignExerciseId, sortOrder: 0, targetSets: 3, targetReps: 10 }],
        }),
      }),
    );
    expect(foreignEx.status).toBe(404);
  });
});
