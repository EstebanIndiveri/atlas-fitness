/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import { CookieJar } from './cookie-jar';
import {
  assertAllowedHost,
  RedirectHostRejectedError,
  SmokeHttpClient,
  UnexpectedHostError,
} from './http-client';
import type { FetchLike } from './types';

function response(body: string, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(body, init);
}

describe('assertAllowedHost', () => {
  it('accepts the expected host and rejects any other', () => {
    expect(() =>
      assertAllowedHost(new URL('https://prod.example/api/x'), 'prod.example'),
    ).not.toThrow();
    expect(() =>
      assertAllowedHost(new URL('https://evil.example/api/x'), 'prod.example'),
    ).toThrow(UnexpectedHostError);
  });
});

describe('SmokeHttpClient', () => {
  it('binds requests to the expected host', async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url);
      return response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      });
    };
    const client = new SmokeHttpClient('https://prod.example', fetchImpl, new CookieJar());
    const result = await client.get('/api/health');
    expect(calls).toEqual(['https://prod.example/api/health']);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });

  it('rejects a redirect to a different host without following it', async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url);
      return response('', { status: 302, headers: { location: 'https://evil.example/x' } });
    };
    const client = new SmokeHttpClient('https://prod.example', fetchImpl, new CookieJar());
    await expect(client.get('/api/health')).rejects.toBeInstanceOf(RedirectHostRejectedError);
    expect(calls).toEqual(['https://prod.example/api/health']);
  });

  it('follows a same-host redirect', async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      calls.push(url);
      if (calls.length === 1) {
        return response('', { status: 307, headers: { location: '/api/other' } });
      }
      return response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      });
    };
    const client = new SmokeHttpClient('https://prod.example', fetchImpl, new CookieJar());
    const result = await client.get('/api/health');
    expect(result.status).toBe(200);
    expect(calls).toEqual(['https://prod.example/api/health', 'https://prod.example/api/other']);
  });

  it('captures Set-Cookie and replays it on the next request', async () => {
    const cookies: Array<string | null> = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      const headers = new Headers(init?.headers);
      cookies.push(headers.get('cookie'));
      if (cookies.length === 1) {
        return response(JSON.stringify({ ok: true }), {
          headers: { 'set-cookie': 'session=abc.def; Path=/; HttpOnly' },
        });
      }
      return response(JSON.stringify({ ok: true }));
    };
    const client = new SmokeHttpClient('https://prod.example', fetchImpl, new CookieJar());
    await client.post('/api/auth/login', { body: { email: 'a', password: 'b' } });
    await client.get('/api/auth/me');
    expect(cookies[0]).toBeNull();
    expect(cookies[1]).toBe('session=abc.def');
  });

  it('passes 429 through with Retry-After', async () => {
    const fetchImpl: FetchLike = async () =>
      response(JSON.stringify({ code: 'RATE_LIMIT' }), {
        status: 429,
        headers: { 'retry-after': '42' },
      });
    const client = new SmokeHttpClient('https://prod.example', fetchImpl, new CookieJar());
    const result = await client.post('/api/auth/login', { body: {} });
    expect(result.status).toBe(429);
    expect(result.headers.get('retry-after')).toBe('42');
  });

  it('flags malformed JSON without throwing', async () => {
    const fetchImpl: FetchLike = async () => response('not-json');
    const client = new SmokeHttpClient('https://prod.example', fetchImpl, new CookieJar());
    const result = await client.get('/api/routines');
    expect(result.jsonOk).toBe(false);
    expect(result.body).toBeNull();
  });
});
