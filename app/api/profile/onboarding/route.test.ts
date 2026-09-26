/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import { userPreferences, users } from '@/lib/db/schema';
import { GET, POST } from './route';

let accountSequence = 0;

async function createAccount(): Promise<{ userId: number; cookie: string }> {
  accountSequence += 1;
  const [user] = await db
    .insert(users)
    .values({
      name: 'Onboarding Test User',
      email: `onboarding-${Date.now()}-${accountSequence}@test.com`,
      passwordHash: 'hash',
    })
    .returning({ id: users.id });

  return {
    userId: user.id,
    cookie: await issueSessionCookieHeader(user.id),
  };
}

function request(method: 'GET' | 'POST', cookie: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/profile/onboarding', {
    method,
    headers: {
      cookie,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('/api/profile/onboarding', () => {
  it('persists Skip completion without creating preferences', async () => {
    const account = await createAccount();

    const skipResponse = await POST(request('POST', account.cookie, { action: 'skip' }));
    const stateResponse = await GET(request('GET', account.cookie));

    expect(skipResponse.status).toBe(200);
    await expect(skipResponse.json()).resolves.toMatchObject({ completed: true });
    expect(stateResponse.status).toBe(200);
    await expect(stateResponse.json()).resolves.toMatchObject({ completed: true });
    await expect(
      db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, account.userId)),
    ).resolves.toHaveLength(0);
  });

  it('saves Finish preferences and account completion together', async () => {
    const account = await createAccount();
    const answers = {
      goal: 'strength',
      pace: 'days-5',
      equipment: 'bands',
    };

    const finishResponse = await POST(
      request('POST', account.cookie, { action: 'finish', answers }),
    );

    expect(finishResponse.status).toBe(200);
    await expect(finishResponse.json()).resolves.toEqual({ completed: true });
    await expect(GET(request('GET', account.cookie)).then((response) => response.json()))
      .resolves.toEqual({ completed: true });
    await expect(
      db
        .select({
          goal: userPreferences.goal,
          pace: userPreferences.pace,
          equipment: userPreferences.equipment,
        })
        .from(userPreferences)
        .where(eq(userPreferences.userId, account.userId)),
    ).resolves.toEqual([answers]);
    const [user] = await db
      .select({ onboardingCompletedAt: users.onboardingCompletedAt })
      .from(users)
      .where(eq(users.id, account.userId));
    expect(user.onboardingCompletedAt).toBeInstanceOf(Date);
  });

  it('leaves completion and preferences unchanged when Finish validation fails', async () => {
    const account = await createAccount();

    const finishResponse = await POST(
      request('POST', account.cookie, {
        action: 'finish',
        answers: { goal: 'unknown', pace: 'days-3', equipment: 'gym' },
      }),
    );

    expect(finishResponse.status).toBe(400);
    await expect(finishResponse.json()).resolves.toMatchObject({ code: 'VALIDATION' });
    await expect(GET(request('GET', account.cookie)).then((response) => response.json()))
      .resolves.toEqual({ completed: false });
    await expect(
      db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, account.userId)),
    ).resolves.toHaveLength(0);
  });

  it('keeps completion state scoped to the authenticated account', async () => {
    const owner = await createAccount();
    const other = await createAccount();

    await POST(request('POST', owner.cookie, { action: 'skip' }));

    await expect(GET(request('GET', owner.cookie)).then((response) => response.json()))
      .resolves.toEqual({ completed: true });
    await expect(GET(request('GET', other.cookie)).then((response) => response.json()))
      .resolves.toEqual({ completed: false });
  });
});
