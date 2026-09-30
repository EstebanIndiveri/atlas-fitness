/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { NextRequest } from 'next/server';

import { GET } from './route';
import { issueSessionCookieHeader } from '@/lib/auth/session-store';
import { db } from '@/lib/db/client';
import {
  botMessages,
  sessions,
  telegramLinkCodes,
  userStreaks,
  users,
} from '@/lib/db/schema';

async function authenticatedRequest(userId: number): Promise<NextRequest> {
  const cookie = await issueSessionCookieHeader(userId);
  return new NextRequest('http://localhost:3000/api/stats/prs', {
    method: 'GET',
    headers: { cookie },
  });
}

function unauthenticatedRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/stats/prs', { method: 'GET' });
}

/**
 * The legacy PR contract is retired: this route must never return a successful
 * PR payload again. It exists only as a typed tombstone so outdated clients fail
 * loudly instead of reading a bare-weight record.
 */
describe('GET /api/stats/prs (retired)', () => {
  let userId: number;

  beforeEach(async () => {
    await db.delete(botMessages);
    await db.delete(telegramLinkCodes);
    await db.delete(userStreaks);
    await db.delete(sessions);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({ name: 'PR Route User', email: 'pr-route@test.com', passwordHash: 'hash' })
      .returning();
    userId = user.id;
  });

  it('returns 401 UNAUTHORIZED without a session, before the tombstone', async () => {
    const response = await GET(unauthenticatedRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns HTTP 410 Gone with the typed PR_CONTRACT_RETIRED body', async () => {
    const response = await GET(await authenticatedRequest(userId));

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      code: 'PR_CONTRACT_RETIRED',
      message: expect.stringMatching(/retiró|progresión/i),
    });
  });

  it('never returns an array of personal records', async () => {
    const response = await GET(await authenticatedRequest(userId));

    expect(response.status).not.toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(false);
  });
});
