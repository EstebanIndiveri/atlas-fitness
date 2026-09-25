/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import { userPreferences, users } from '@/lib/db/schema';
import type { UserPreferences } from '@/types/user-preferences';
import { GET, PUT } from './route';

let accountSequence = 0;

async function createAccount(): Promise<{ userId: number; cookie: string }> {
  accountSequence += 1;
  const [user] = await db
    .insert(users)
    .values({
      name: 'Profile Preferences Test User',
      email: `profile-preferences-${Date.now()}-${accountSequence}@test.com`,
      passwordHash: 'hash',
    })
    .returning({ id: users.id });

  return {
    userId: user.id,
    cookie: await issueSessionCookieHeader(user.id),
  };
}

function request(
  method: 'GET' | 'PUT',
  cookie?: string,
  body?: unknown,
  query = '',
): NextRequest {
  return new NextRequest(`http://localhost:3000/api/profile/preferences${query}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function malformedPut(cookie: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/profile/preferences', {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: '{"goal":',
  });
}

describe('/api/profile/preferences', () => {
  it('returns null preferences without inserting a row when none have been saved', async () => {
    const account = await createAccount();

    const response = await GET(request('GET', account.cookie));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      goal: null,
      pace: null,
      equipment: null,
    });
    const rows = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, account.userId));
    expect(rows).toHaveLength(0);
  });

  it('persists and returns the exact allowed option IDs', async () => {
    const account = await createAccount();
    const preferences: UserPreferences = {
      goal: 'strength',
      pace: 'days-5',
      equipment: 'bands',
    };

    const putResponse = await PUT(request('PUT', account.cookie, preferences));

    expect(putResponse.status).toBe(200);
    await expect(putResponse.json()).resolves.toEqual(preferences);
    const getResponse = await GET(request('GET', account.cookie));
    await expect(getResponse.json()).resolves.toEqual(preferences);
  });

  it('accepts explicit null values to clear saved preferences', async () => {
    const account = await createAccount();

    const response = await PUT(
      request('PUT', account.cookie, {
        goal: null,
        pace: null,
        equipment: null,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      goal: null,
      pace: null,
      equipment: null,
    });
  });

  it.each([
    { goal: 'unknown-goal', pace: 'days-3', equipment: 'gym' },
    { goal: 'strength', pace: 'days-6', equipment: 'gym' },
    { goal: 'strength', pace: 'days-3', equipment: 'unknown-equipment' },
  ])('rejects IDs that are not in the onboarding choices: %o', async (preferences) => {
    const account = await createAccount();

    const response = await PUT(request('PUT', account.cookie, preferences));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects malformed JSON without writing preferences', async () => {
    const account = await createAccount();

    const response = await PUT(malformedPut(account.cookie));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION' });
    const rows = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, account.userId));
    expect(rows).toHaveLength(0);
  });

  it('rejects a body userId override instead of writing for another account', async () => {
    const account = await createAccount();
    const otherAccount = await createAccount();

    const response = await PUT(
      request('PUT', account.cookie, {
        userId: otherAccount.userId,
        goal: 'strength',
        pace: 'days-3',
        equipment: 'gym',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION' });
    const accountRows = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, account.userId));
    const otherAccountRows = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, otherAccount.userId));
    expect(accountRows).toHaveLength(0);
    expect(otherAccountRows).toHaveLength(0);
  });

  it('ignores a query userId and keeps GET scoped to the authenticated account', async () => {
    const account = await createAccount();
    const otherAccount = await createAccount();
    const otherPreferences: UserPreferences = {
      goal: 'muscle',
      pace: 'days-4',
      equipment: 'dumbbells',
    };
    await PUT(request('PUT', otherAccount.cookie, otherPreferences));

    const response = await GET(
      request('GET', account.cookie, undefined, `?userId=${otherAccount.userId}`),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      goal: null,
      pace: null,
      equipment: null,
    });
  });

  it('returns 401 for unauthenticated GET and PUT requests', async () => {
    const getResponse = await GET(request('GET'));
    const putResponse = await PUT(
      request('PUT', undefined, { goal: null, pace: null, equipment: null }),
    );

    expect(getResponse.status).toBe(401);
    await expect(getResponse.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(putResponse.status).toBe(401);
    await expect(putResponse.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
