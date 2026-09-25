/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { GET } from './route';
import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import { sessions, trainingPlans, users } from '@/lib/db/schema';

const CREATED_AT = new Date('2024-09-15T15:00:00.000Z');
let accountSequence = 0;

async function createAuthenticatedUser(): Promise<{ userId: number; cookie: string }> {
  accountSequence += 1;
  const [user] = await db
    .insert(users)
    .values({
      name: 'Profile Contract User',
      email: `profile-contract-${Date.now()}-${accountSequence}@test.com`,
      passwordHash: 'hash',
      createdAt: CREATED_AT,
    })
    .returning({ id: users.id });

  return {
    userId: user.id,
    cookie: await issueSessionCookieHeader(user.id),
  };
}

function request(cookie: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/me', {
    method: 'GET',
    headers: { cookie },
  });
}

describe('/api/auth/me profile contract', () => {
  beforeEach(async () => {
    await db.delete(sessions);
    await db.delete(trainingPlans);
    await db.delete(users);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the account creation date and its active owned plan id', async () => {
    const account = await createAuthenticatedUser();
    const otherAccount = await createAuthenticatedUser();
    await db.insert(trainingPlans).values({
      userId: otherAccount.userId,
      name: 'Another account plan',
      isActive: true,
    });
    const [activePlan] = await db.insert(trainingPlans).values({
      userId: account.userId,
      name: 'Active plan',
      goal: 'Fuerza',
      isActive: true,
    }).returning({ id: trainingPlans.id });

    const response = await GET(request(account.cookie));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: account.userId,
      createdAt: CREATED_AT.toISOString(),
      activeTrainingPlanId: activePlan.id,
    });
  });

  it('returns a null active plan id when no active, non-deleted plan exists', async () => {
    const account = await createAuthenticatedUser();
    await db.insert(trainingPlans).values([
      {
        userId: account.userId,
        name: 'Inactive plan',
        isActive: false,
      },
      {
        userId: account.userId,
        name: 'Deleted active plan',
        isActive: true,
        deletedAt: new Date(),
      },
    ]);

    const response = await GET(request(account.cookie));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      activeTrainingPlanId: null,
    });
  });

  it('returns a server error rather than a false no-plan result when plan lookup fails', async () => {
    const account = await createAuthenticatedUser();
    const planLookup = jest
      .spyOn(db.query.trainingPlans, 'findFirst')
      .mockRejectedValueOnce(new Error('database unavailable'));

    const response = await GET(request(account.cookie));

    expect(planLookup).toHaveBeenCalled();
    expect(response.status).toBe(500);
    const body: unknown = await response.json();
    expect(body).not.toEqual(
      expect.objectContaining({ message: 'database unavailable' }),
    );
  });
});
