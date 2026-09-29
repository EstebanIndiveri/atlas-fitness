/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { DELETE, PUT } from './route';
import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import { habitLogs, habitTargetDays, habitTargetSchedules, sessions, users } from '@/lib/db/schema';

// 2026-09-24T15:00:00Z is 2026-09-24 12:00 in Córdoba: a Thursday (Sunday-first weekday 4).
const TODAY = new Date('2026-09-24T15:00:00.000Z');
const TODAY_LOCAL_DATE = '2026-09-24';

function routeParams(habitKey: string): { params: Promise<{ habitKey: string }> } {
  return { params: Promise.resolve({ habitKey }) };
}

async function authenticatedRequest(
  userId: number,
  habitKey: string,
  method: 'PUT' | 'DELETE',
  body?: unknown,
): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest(`http://localhost:3000/api/habit-targets/${habitKey}`, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function malformedRequest(
  userId: number,
  habitKey: string,
  method: 'PUT' | 'DELETE',
): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest(`http://localhost:3000/api/habit-targets/${habitKey}`, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    body: '{"weekdays":',
  });
}

function unauthenticatedRequest(
  habitKey: string,
  method: 'PUT' | 'DELETE',
  body: unknown,
): NextRequest {
  return new NextRequest(`http://localhost:3000/api/habit-targets/${habitKey}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function insertUser(email: string): Promise<number> {
  const [user] = await db
    .insert(users)
    .values({ name: 'Habit Target Write User', email, passwordHash: 'hash' })
    .returning();

  return user.id;
}

type TargetBody = {
  id: number;
  userId: number;
  habitKey: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  weekdays: number[];
  createdAt: string;
  updatedAt: string;
};

describe('/api/habit-targets/[habitKey] PUT and DELETE', () => {
  let userId: number;
  let otherId: number;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(TODAY);

    await db.delete(habitTargetDays);
    await db.delete(habitTargetSchedules);
    await db.delete(habitLogs);
    await db.delete(sessions);
    await db.delete(users);

    userId = await insertUser('habit-target-write@test.com');
    otherId = await insertUser('habit-target-write-other@test.com');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 401 UNAUTHORIZED for PUT without a session', async () => {
    const response = await PUT(
      unauthenticatedRequest('walk', 'PUT', { weekdays: [1], expectedTargetId: null, expectedVersion: null }),
      routeParams('walk'),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns 401 UNAUTHORIZED for DELETE without a session', async () => {
    const response = await DELETE(
      unauthenticatedRequest('walk', 'DELETE', { expectedTargetId: 1, expectedVersion: 1 }),
      routeParams('walk'),
    );

    expect(response.status).toBe(401);
  });

  it('returns 400 VALIDATION for a malformed JSON body', async () => {
    const response = await PUT(await malformedRequest(userId, 'walk', 'PUT'), routeParams('walk'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'Objetivo de hábito inválido',
    });
    await expect(db.select().from(habitTargetSchedules)).resolves.toHaveLength(0);
  });

  it('returns 404 NOT_FOUND for a habit outside the closed catalog (PUT and DELETE)', async () => {
    const put = await PUT(
      await authenticatedRequest(userId, 'meditation', 'PUT', {
        weekdays: [1],
        expectedTargetId: null,
        expectedVersion: null,
      }),
      routeParams('meditation'),
    );
    expect(put.status).toBe(404);
    await expect(put.json()).resolves.toEqual({
      code: 'NOT_FOUND',
      message: 'Hábito no encontrado',
    });

    const del = await DELETE(
      await authenticatedRequest(userId, 'meditation', 'DELETE', {
        expectedTargetId: 1,
        expectedVersion: 1,
      }),
      routeParams('meditation'),
    );
    expect(del.status).toBe(404);
  });

  it.each([
    ['empty', []],
    ['duplicated', [1, 1]],
    ['out of range', [7]],
    ['negative', [-1]],
    ['non-integer', [1.5]],
    ['more than seven', [0, 1, 2, 3, 4, 5, 6, 0]],
  ])('returns 400 VALIDATION for an %s weekday selection', async (_label, weekdays) => {
    const response = await PUT(
      await authenticatedRequest(userId, 'walk', 'PUT', {
        weekdays,
        expectedTargetId: null,
        expectedVersion: null,
      }),
      routeParams('walk'),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION' });
    await expect(db.select().from(habitTargetSchedules)).resolves.toHaveLength(0);
  });

  it('creates the first version with 201 and the exact serialized payload', async () => {
    const response = await PUT(
      await authenticatedRequest(userId, 'walk', 'PUT', {
        weekdays: [4, 2],
        expectedTargetId: null,
        expectedVersion: null,
      }),
      routeParams('walk'),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: expect.any(Number),
      userId,
      habitKey: 'walk',
      effectiveFrom: TODAY_LOCAL_DATE,
      effectiveTo: null,
      version: 1,
      weekdays: [2, 4],
      createdAt: TODAY.toISOString(),
      updatedAt: TODAY.toISOString(),
    });
  });

  it('updates with 200, increments the version and replaces the weekdays', async () => {
    const created = (await (
      await PUT(
        await authenticatedRequest(userId, 'walk', 'PUT', {
          weekdays: [1],
          expectedTargetId: null,
          expectedVersion: null,
        }),
        routeParams('walk'),
      )
    ).json()) as TargetBody;

    const response = await PUT(
      await authenticatedRequest(userId, 'walk', 'PUT', {
        weekdays: [3, 5],
        expectedTargetId: created.id,
        expectedVersion: created.version,
      }),
      routeParams('walk'),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as TargetBody;
    expect(body.id).toBe(created.id);
    expect(body.version).toBe(2);
    expect(body.weekdays).toEqual([3, 5]);
    await expect(db.select().from(habitTargetSchedules)).resolves.toHaveLength(1);
  });

  it('returns 409 CONFLICT for a stale token and writes nothing', async () => {
    const created = (await (
      await PUT(
        await authenticatedRequest(userId, 'walk', 'PUT', {
          weekdays: [1],
          expectedTargetId: null,
          expectedVersion: null,
        }),
        routeParams('walk'),
      )
    ).json()) as TargetBody;

    await PUT(
      await authenticatedRequest(userId, 'walk', 'PUT', {
        weekdays: [2],
        expectedTargetId: created.id,
        expectedVersion: created.version,
      }),
      routeParams('walk'),
    );

    const stale = await PUT(
      await authenticatedRequest(userId, 'walk', 'PUT', {
        weekdays: [6],
        expectedTargetId: created.id,
        expectedVersion: created.version,
      }),
      routeParams('walk'),
    );

    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({ code: 'CONFLICT' });
    const rows = await db.select().from(habitTargetSchedules);
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe(2);
  });

  it('is idempotent: repeating the same PUT keeps one version and the same state', async () => {
    const created = (await (
      await PUT(
        await authenticatedRequest(userId, 'walk', 'PUT', {
          weekdays: [1, 2],
          expectedTargetId: null,
          expectedVersion: null,
        }),
        routeParams('walk'),
      )
    ).json()) as TargetBody;

    const repeated = await PUT(
      await authenticatedRequest(userId, 'walk', 'PUT', {
        weekdays: [1, 2],
        expectedTargetId: created.id,
        expectedVersion: created.version,
      }),
      routeParams('walk'),
    );

    expect(repeated.status).toBe(200);
    const body = (await repeated.json()) as TargetBody;
    expect(body.id).toBe(created.id);
    expect(body.version).toBe(1);
    await expect(db.select().from(habitTargetSchedules)).resolves.toHaveLength(1);
  });

  it('deletes a version created today with 200 { activeTarget: null }', async () => {
    const created = (await (
      await PUT(
        await authenticatedRequest(userId, 'walk', 'PUT', {
          weekdays: [1],
          expectedTargetId: null,
          expectedVersion: null,
        }),
        routeParams('walk'),
      )
    ).json()) as TargetBody;

    const response = await DELETE(
      await authenticatedRequest(userId, 'walk', 'DELETE', {
        expectedTargetId: created.id,
        expectedVersion: created.version,
      }),
      routeParams('walk'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ activeTarget: null });
    await expect(db.select().from(habitTargetSchedules)).resolves.toHaveLength(0);
    await expect(db.select().from(habitTargetDays)).resolves.toHaveLength(0);
  });

  it('returns 400 VALIDATION for an incomplete deactivation token', async () => {
    const response = await DELETE(
      await authenticatedRequest(userId, 'walk', 'DELETE', { expectedTargetId: 1 }),
      routeParams('walk'),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION' });
  });

  it('is idempotent: repeating the same DELETE returns the absent state', async () => {
    const created = (await (
      await PUT(
        await authenticatedRequest(userId, 'walk', 'PUT', {
          weekdays: [1],
          expectedTargetId: null,
          expectedVersion: null,
        }),
        routeParams('walk'),
      )
    ).json()) as TargetBody;
    const token = { expectedTargetId: created.id, expectedVersion: created.version };

    const first = await DELETE(
      await authenticatedRequest(userId, 'walk', 'DELETE', token),
      routeParams('walk'),
    );
    const second = await DELETE(
      await authenticatedRequest(userId, 'walk', 'DELETE', token),
      routeParams('walk'),
    );

    expect(first.status).toBe(200);
    await expect(second.json()).resolves.toEqual({ activeTarget: null });
  });

  it('returns 409 CONFLICT for a DELETE token that no longer matches the active target', async () => {
    const created = (await (
      await PUT(
        await authenticatedRequest(userId, 'walk', 'PUT', {
          weekdays: [1],
          expectedTargetId: null,
          expectedVersion: null,
        }),
        routeParams('walk'),
      )
    ).json()) as TargetBody;

    await PUT(
      await authenticatedRequest(userId, 'walk', 'PUT', {
        weekdays: [2],
        expectedTargetId: created.id,
        expectedVersion: created.version,
      }),
      routeParams('walk'),
    );

    const stale = await DELETE(
      await authenticatedRequest(userId, 'walk', 'DELETE', {
        expectedTargetId: created.id,
        expectedVersion: created.version,
      }),
      routeParams('walk'),
    );

    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({ code: 'CONFLICT' });
  });

  it('isolates users: a foreign token cannot mutate or read another user target', async () => {
    const created = (await (
      await PUT(
        await authenticatedRequest(userId, 'walk', 'PUT', {
          weekdays: [1],
          expectedTargetId: null,
          expectedVersion: null,
        }),
        routeParams('walk'),
      )
    ).json()) as TargetBody;

    const foreignPut = await PUT(
      await authenticatedRequest(otherId, 'walk', 'PUT', {
        weekdays: [2],
        expectedTargetId: created.id,
        expectedVersion: created.version,
      }),
      routeParams('walk'),
    );

    expect(foreignPut.status).toBe(409);
    const rows = await db.select().from(habitTargetSchedules);
    expect(rows).toHaveLength(1);
    expect(rows[0].habitKey).toBe('walk');
    const ownedDays = await db.select().from(habitTargetDays);
    expect(ownedDays.map((day) => day.dayOfWeek)).toEqual([1]);
  });

  it('ignores a userId smuggled in the body and uses the session user', async () => {
    const created = (await (
      await PUT(
        await authenticatedRequest(otherId, 'sleep', 'PUT', {
          weekdays: [0],
          expectedTargetId: null,
          expectedVersion: null,
          userId,
        }),
        routeParams('sleep'),
      )
    ).json()) as TargetBody;

    expect(created.userId).toBe(otherId);
  });
});
