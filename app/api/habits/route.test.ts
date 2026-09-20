/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { GET, POST } from './route';
import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import { habitLogs, sessions, users } from '@/lib/db/schema';

const TODAY = new Date('2026-09-19T15:00:00.000Z');
const TODAY_LOCAL_DATE = '2026-09-19';

async function authenticatedRequest(
  userId: number,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest('http://localhost:3000/api/habits', {
    method,
    headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function unauthenticatedRequest(method: 'GET' | 'POST', body?: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/habits', {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function malformedAuthenticatedPost(userId: number): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest('http://localhost:3000/api/habits', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: '{"habitKey":',
  });
}

describe('/api/habits', () => {
  let userId: number;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(TODAY);

    await db.delete(habitLogs);
    await db.delete(sessions);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({ name: 'Habits Route User', email: 'habits-route@test.com', passwordHash: 'hash' })
      .returning();
    userId = user.id;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns HTTP 200 with the upserted habit log', async () => {
    const response = await POST(
      await authenticatedRequest(userId, 'POST', { habitKey: 'hydration', done: true }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: expect.any(Number),
      userId,
      localDate: TODAY_LOCAL_DATE,
      habitKey: 'hydration',
      done: true,
    });
  });

  it('toggles a habit off idempotently via POST', async () => {
    await POST(await authenticatedRequest(userId, 'POST', { habitKey: 'walk', done: true }));
    const response = await POST(
      await authenticatedRequest(userId, 'POST', { habitKey: 'walk', done: false }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ habitKey: 'walk', done: false });
  });

  it('returns 400 VALIDATION for an unknown habit key', async () => {
    const response = await POST(
      await authenticatedRequest(userId, 'POST', { habitKey: 'meditation', done: true }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'Registro de hábito inválido',
    });
  });

  it('returns 400 VALIDATION when the JSON body is malformed', async () => {
    const response = await POST(await malformedAuthenticatedPost(userId));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'Registro de hábito inválido',
    });
  });

  it('returns today habit logs for GET', async () => {
    await POST(await authenticatedRequest(userId, 'POST', { habitKey: 'hydration', done: true }));
    await POST(await authenticatedRequest(userId, 'POST', { habitKey: 'sleep', done: true }));

    const response = await GET(await authenticatedRequest(userId, 'GET'));

    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<{ habitKey: string }>;
    expect(body.map((row) => row.habitKey).sort()).toEqual(['hydration', 'sleep']);
  });

  it('returns an empty array for GET when today has no logs', async () => {
    const response = await GET(await authenticatedRequest(userId, 'GET'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it('returns 401 UNAUTHORIZED without a session', async () => {
    const response = await GET(unauthenticatedRequest('GET'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns 401 UNAUTHORIZED for POST without a session', async () => {
    const response = await POST(unauthenticatedRequest('POST', { habitKey: 'walk', done: true }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
