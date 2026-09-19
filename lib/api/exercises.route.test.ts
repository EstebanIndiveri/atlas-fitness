/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/exercises/route';
import { DELETE, GET as GET_ONE, PATCH } from '@/app/api/exercises/[id]/route';
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
import type { ExerciseCatalogItem } from '@/types/exercise';

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

describe('Exercises API ownership', () => {
  let ownerId: number;
  let otherId: number;
  let systemId: number;
  let ownId: number;
  let foreignId: number;

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

    const [owner] = await db
      .insert(users)
      .values({ name: 'Owner API', email: 'owner-api-ex@test.com', passwordHash: 'hash' })
      .returning();
    const [other] = await db
      .insert(users)
      .values({ name: 'Other API', email: 'other-api-ex@test.com', passwordHash: 'hash' })
      .returning();
    ownerId = owner.id;
    otherId = other.id;

    const [system] = await db
      .insert(exercises)
      .values({
        slug: 'bench-press',
        name: 'Press Banca',
        muscleGroup: 'Pecho',
        instructions: 'x',
        isSystem: true,
      })
      .returning();
    const [own] = await db
      .insert(exercises)
      .values({
        slug: 'owner-api-curl',
        name: 'Curl API',
        muscleGroup: 'Biceps',
        instructions: 'x',
        isSystem: false,
        userId: ownerId,
      })
      .returning();
    const [foreign] = await db
      .insert(exercises)
      .values({
        slug: 'other-api-curl',
        name: 'Curl ajeno API',
        muscleGroup: 'Biceps',
        instructions: 'x',
        isSystem: false,
        userId: otherId,
      })
      .returning();
    systemId = system.id;
    ownId = own.id;
    foreignId = foreign.id;
  });

  it('GET list returns system + own and omits userId', async () => {
    const response = await GET(await authed(ownerId, 'http://localhost:3000/api/exercises'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as ExerciseCatalogItem[];
    expect(body.map((item) => item.slug).sort()).toEqual(['bench-press', 'owner-api-curl']);
    expect(body.every((item) => !('userId' in item))).toBe(true);
  });

  it('GET by id returns system and own; 404 for foreign', async () => {
    const systemRes = await GET_ONE(await authed(ownerId, `http://localhost:3000/api/exercises/${systemId}`), {
      params: Promise.resolve({ id: String(systemId) }),
    });
    expect(systemRes.status).toBe(200);

    const ownRes = await GET_ONE(await authed(ownerId, `http://localhost:3000/api/exercises/${ownId}`), {
      params: Promise.resolve({ id: String(ownId) }),
    });
    expect(ownRes.status).toBe(200);

    const foreignRes = await GET_ONE(
      await authed(ownerId, `http://localhost:3000/api/exercises/${foreignId}`),
      { params: Promise.resolve({ id: String(foreignId) }) },
    );
    expect(foreignRes.status).toBe(404);
    await expect(foreignRes.json()).resolves.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('POST/PATCH round-trip imageUrl and videoUrl on own custom', async () => {
    const created = await POST(
      await authed(ownerId, 'http://localhost:3000/api/exercises', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Face Pull',
          muscleGroup: 'Espalda',
          instructions: 'Tirar',
          imageUrl: 'https://cdn.example.com/face.png',
          videoUrl: 'https://youtube.com/watch?v=face',
        }),
      }),
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as ExerciseCatalogItem;
    expect(createdBody.imageUrl).toBe('https://cdn.example.com/face.png');
    expect(createdBody.videoUrl).toBe('https://youtube.com/watch?v=face');

    const patched = await PATCH(
      await authed(ownerId, `http://localhost:3000/api/exercises/${createdBody.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ videoUrl: 'https://youtube.com/watch?v=face-v2' }),
      }),
      { params: Promise.resolve({ id: String(createdBody.id) }) },
    );
    expect(patched.status).toBe(200);
    const updated = (await patched.json()) as ExerciseCatalogItem;
    expect(updated.imageUrl).toBe('https://cdn.example.com/face.png');
    expect(updated.videoUrl).toBe('https://youtube.com/watch?v=face-v2');
  });

  it('POST creates own custom; PATCH/DELETE foreign are 404', async () => {
    const created = await POST(
      await authed(ownerId, 'http://localhost:3000/api/exercises', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Remo',
          muscleGroup: 'Espalda',
          instructions: 'Tirar',
        }),
      }),
    );
    expect(created.status).toBe(201);

    const patched = await PATCH(
      await authed(ownerId, `http://localhost:3000/api/exercises/${foreignId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Hack' }),
      }),
      { params: Promise.resolve({ id: String(foreignId) }) },
    );
    expect(patched.status).toBe(404);

    const deleted = await DELETE(
      await authed(ownerId, `http://localhost:3000/api/exercises/${foreignId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: String(foreignId) }) },
    );
    expect(deleted.status).toBe(404);
  });
});
