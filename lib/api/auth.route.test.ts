/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { GET as me } from '@/app/api/auth/me/route';
import { POST as register } from '@/app/api/auth/register/route';
import { decodeSession, encodeSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { persistSession, revokeSession } from '@/lib/auth/session-store';
import { SESSION_MAX_AGE_SECONDS } from '@/lib/auth/session-payload';
import { db } from '@/lib/db/client';
import { rateLimitBuckets, sessions, users } from '@/lib/db/schema';
import type { SessionData } from '@/types/auth';

const PASSWORD = 'Test1234!';

function cookieValueFromSetCookie(header: string | null): string {
  if (!header) {
    throw new Error('missing Set-Cookie');
  }
  const match = header.match(/atlas_session=([^;]+)/);
  if (!match) {
    throw new Error('missing atlas_session');
  }
  return match[1];
}

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function cookieRequest(url: string, method: string, cookieValue: string): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
  });
}

describe('auth session API', () => {
  beforeEach(async () => {
    await db.delete(rateLimitBuckets);
    await db.delete(sessions);
    await db.delete(users);
  });

  it('issues a unique sessionId on each login', async () => {
    const email = 'session-unique@test.com';
    const registerResponse = await register(
      jsonRequest('http://localhost:3000/api/auth/register', {
        name: 'Session Unique',
        email,
        password: PASSWORD,
      }),
    );
    expect(registerResponse.status).toBe(201);

    const firstLogin = await login(
      jsonRequest('http://localhost:3000/api/auth/login', { email, password: PASSWORD }),
    );
    const secondLogin = await login(
      jsonRequest('http://localhost:3000/api/auth/login', { email, password: PASSWORD }),
    );

    expect(firstLogin.status).toBe(200);
    expect(secondLogin.status).toBe(200);

    const first = decodeSession(cookieValueFromSetCookie(firstLogin.headers.get('set-cookie')));
    const second = decodeSession(cookieValueFromSetCookie(secondLogin.headers.get('set-cookie')));

    expect(first?.userId).toBe(second?.userId);
    expect(first?.sessionId).toBeDefined();
    expect(second?.sessionId).toBeDefined();
    expect(first?.sessionId).not.toBe(second?.sessionId);
  });

  it('rejects an expired cookie on /api/auth/me', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired: SessionData = {
      userId: 1,
      sessionId: 'ab'.repeat(16),
      iat: now - 100,
      exp: now - 1,
    };

    expect(decodeSession(encodeSession(expired))).toBeNull();

    const response = await me(
      cookieRequest('http://localhost:3000/api/auth/me', 'GET', encodeSession(expired)),
    );
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
    expect(body.message).toBe('Autenticación requerida');
  });

  it('rejects a signed cookie whose sessionId is missing from the store', async () => {
    const registerResponse = await register(
      jsonRequest('http://localhost:3000/api/auth/register', {
        name: 'Session Missing',
        email: 'session-missing@test.com',
        password: PASSWORD,
      }),
    );
    expect(registerResponse.status).toBe(201);
    const user = (await registerResponse.json()) as { id: number };

    const orphan = encodeSession({
      userId: user.id,
      sessionId: 'aa'.repeat(16),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    });

    const response = await me(cookieRequest('http://localhost:3000/api/auth/me', 'GET', orphan));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('rejects a revoked sessionId on /api/auth/me', async () => {
    const email = 'session-revoked@test.com';
    const registerResponse = await register(
      jsonRequest('http://localhost:3000/api/auth/register', {
        name: 'Session Revoked',
        email,
        password: PASSWORD,
      }),
    );
    expect(registerResponse.status).toBe(201);
    const user = (await registerResponse.json()) as { id: number };

    const payload = await persistSession(user.id);
    const cookieValue = encodeSession(payload);

    const before = await me(cookieRequest('http://localhost:3000/api/auth/me', 'GET', cookieValue));
    expect(before.status).toBe(200);

    await revokeSession(payload.sessionId);

    const after = await me(cookieRequest('http://localhost:3000/api/auth/me', 'GET', cookieValue));
    const body = (await after.json()) as { code: string };

    expect(after.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when the same cookie is reused after logout', async () => {
    const email = 'session-logout@test.com';
    await register(
      jsonRequest('http://localhost:3000/api/auth/register', {
        name: 'Session Logout',
        email,
        password: PASSWORD,
      }),
    );

    const loginResponse = await login(
      jsonRequest('http://localhost:3000/api/auth/login', { email, password: PASSWORD }),
    );
    const cookieValue = cookieValueFromSetCookie(loginResponse.headers.get('set-cookie'));

    const before = await me(cookieRequest('http://localhost:3000/api/auth/me', 'GET', cookieValue));
    expect(before.status).toBe(200);

    const logoutResponse = await logout(
      cookieRequest('http://localhost:3000/api/auth/logout', 'POST', cookieValue),
    );
    expect(logoutResponse.status).toBe(200);

    const after = await me(cookieRequest('http://localhost:3000/api/auth/me', 'GET', cookieValue));
    const body = (await after.json()) as { code: string };

    expect(after.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });
});
