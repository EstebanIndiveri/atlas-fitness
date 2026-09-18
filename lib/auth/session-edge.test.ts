import { describe, expect, it } from '@jest/globals';
import { decodeSession, encodeSession } from './session';
import { decodeSessionEdge, getSessionFromCookiesEdge } from './session-edge';
import { buildSessionPayload, SESSION_COOKIE_NAME } from './session-payload';
import type { SessionData } from '@/types/auth';

function sampleSession(userId: number): SessionData {
  return buildSessionPayload(userId);
}

describe('session-edge decode parity', () => {
  it('accepts a Node-encoded unexpired cookie', async () => {
    const payload = sampleSession(15);
    const encoded = encodeSession(payload);

    await expect(decodeSessionEdge(encoded)).resolves.toEqual(payload);
    expect(decodeSession(encoded)).toEqual(payload);
  });

  it('rejects expired and tampered cookies with the same rules as Node', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired: SessionData = {
      userId: 4,
      sessionId: 'cd'.repeat(16),
      iat: now - 100,
      exp: now - 5,
    };
    const encodedExpired = encodeSession(expired);
    const [payload] = encodeSession(sampleSession(4)).split('.');

    await expect(decodeSessionEdge(encodedExpired)).resolves.toBeNull();
    expect(decodeSession(encodedExpired)).toBeNull();
    await expect(decodeSessionEdge(`${payload}.deadbeef`)).resolves.toBeNull();
    await expect(decodeSessionEdge('invalid')).resolves.toBeNull();
  });

  it('reads the session cookie from a header', async () => {
    const payload = sampleSession(8);
    const header = `${SESSION_COOKIE_NAME}=${encodeSession(payload)}`;

    await expect(getSessionFromCookiesEdge(header)).resolves.toEqual(payload);
    await expect(getSessionFromCookiesEdge(null)).resolves.toBeNull();
  });
});
