/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as register } from '@/app/api/auth/register/route';
import {
  AUTH_RATE_LIMIT_MESSAGE,
  AUTH_RATE_LIMIT_WINDOW_SECONDS,
  DEFAULT_AUTH_RATE_LIMITS,
  authRateLimitKey,
  type AuthRateLimitAction,
} from '@/lib/auth/rate-limit';
import { windowStartSeconds } from '@/lib/services/rate-limit';
import { db } from '@/lib/db/client';
import { rateLimitBuckets, sessions, users } from '@/lib/db/schema';

const PASSWORD = 'Test1234!';

function jsonRequest(
  url: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
}

async function parseError(response: Response): Promise<{ code: string; message: string }> {
  return (await response.json()) as { code: string; message: string };
}

async function fillBucket(
  action: AuthRateLimitAction,
  ip: string,
  count: number,
): Promise<void> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  await db.insert(rateLimitBuckets).values({
    key: authRateLimitKey(action, ip),
    windowStart: windowStartSeconds(nowSeconds, AUTH_RATE_LIMIT_WINDOW_SECONDS),
    count,
  });
}

describe('auth rate-limit API', () => {
  beforeEach(async () => {
    await db.delete(rateLimitBuckets);
    await db.delete(sessions);
    await db.delete(users);
  });

  it('allows login and register under the limit', async () => {
    const ip = { 'x-forwarded-for': '203.0.113.50' };
    const email = 'under-limit@test.com';

    const registerResponse = await register(
      jsonRequest(
        'http://localhost:3000/api/auth/register',
        { name: 'Under Limit', email, password: PASSWORD },
        ip,
      ),
    );
    expect(registerResponse.status).toBe(201);

    const loginResponse = await login(
      jsonRequest(
        'http://localhost:3000/api/auth/login',
        { email, password: PASSWORD },
        ip,
      ),
    );
    expect(loginResponse.status).toBe(200);
  });

  it('returns 429 and Retry-After when login is over the limit', async () => {
    const ip = '203.0.113.51';
    const headers = { 'x-forwarded-for': ip };
    const body = { email: 'nobody@test.com', password: PASSWORD };

    await fillBucket('login', ip, DEFAULT_AUTH_RATE_LIMITS.login - 1);

    const allowed = await login(
      jsonRequest('http://localhost:3000/api/auth/login', body, headers),
    );
    const blocked = await login(
      jsonRequest('http://localhost:3000/api/auth/login', body, headers),
    );
    const error = await parseError(blocked);

    expect(allowed.status).toBe(401);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toMatch(/^[1-9]\d*$/);
    expect(Number(blocked.headers.get('Retry-After'))).toBeLessThanOrEqual(60);
    expect(error).toEqual({
      code: 'RATE_LIMIT',
      message: AUTH_RATE_LIMIT_MESSAGE,
    });
    expect(JSON.stringify(error).toLowerCase()).not.toContain('email');
  });

  it('isolates counters per IP', async () => {
    const body = { email: 'nobody@test.com', password: PASSWORD };
    await fillBucket('login', '203.0.113.52', DEFAULT_AUTH_RATE_LIMITS.login);

    const ipA = await login(
      jsonRequest('http://localhost:3000/api/auth/login', body, {
        'x-forwarded-for': '203.0.113.52, 10.0.0.1',
      }),
    );
    const ipB = await login(
      jsonRequest('http://localhost:3000/api/auth/login', body, {
        'x-forwarded-for': '198.51.100.52',
      }),
    );

    expect(ipA.status).toBe(429);
    expect(ipB.status).toBe(401);
  });

  it('keeps login and register counters separate', async () => {
    const ip = '203.0.113.53';
    const headers = { 'x-real-ip': ip };
    await fillBucket('login', ip, DEFAULT_AUTH_RATE_LIMITS.login);

    const loginBlocked = await login(
      jsonRequest(
        'http://localhost:3000/api/auth/login',
        { email: 'nobody@test.com', password: PASSWORD },
        headers,
      ),
    );
    const registerResponse = await register(
      jsonRequest(
        'http://localhost:3000/api/auth/register',
        { name: 'Separate', email: 'separate-action@test.com', password: PASSWORD },
        headers,
      ),
    );

    expect(loginBlocked.status).toBe(429);
    expect(registerResponse.status).toBe(201);
  });

  it('returns 429 on register when over the limit', async () => {
    const ip = '203.0.113.54';
    const headers = { 'x-forwarded-for': ip };
    await fillBucket('register', ip, DEFAULT_AUTH_RATE_LIMITS.register - 1);

    const allowed = await register(
      jsonRequest(
        'http://localhost:3000/api/auth/register',
        { name: 'One', email: 'one-reg@test.com', password: PASSWORD },
        headers,
      ),
    );
    const blocked = await register(
      jsonRequest(
        'http://localhost:3000/api/auth/register',
        { name: 'Two', email: 'two-reg@test.com', password: PASSWORD },
        headers,
      ),
    );
    const error = await parseError(blocked);

    expect(allowed.status).toBe(201);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toMatch(/^[1-9]\d*$/);
    expect(error.code).toBe('RATE_LIMIT');
    expect(error.message).toBe(AUTH_RATE_LIMIT_MESSAGE);
  });
});
