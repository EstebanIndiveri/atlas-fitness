import { createHmac } from 'crypto';
import { describe, expect, it } from '@jest/globals';
import { encodeSession, decodeSession, createSessionCookie, parseCookies } from './session';
import { buildSessionPayload, SESSION_MAX_AGE_SECONDS } from './session-payload';
import type { SessionData } from '@/types/auth';

function sampleSession(userId: number): SessionData {
  return buildSessionPayload(userId);
}

function cookieValue(setCookie: string): string {
  const match = setCookie.match(/atlas_session=([^;]+)/);
  if (!match) {
    throw new Error('missing atlas_session');
  }
  return match[1];
}

describe('Session utilities', () => {
  describe('parseCookies', () => {
    it('should parse simple cookies', () => {
      const cookieHeader = 'name=value; other=test';
      const cookies = parseCookies(cookieHeader);

      expect(cookies.name).toBe('value');
      expect(cookies.other).toBe('test');
    });

    it('should handle cookies with base64 padding (=)', () => {
      const cookieHeader = 'session=eyJhbGciOiJIUzI1NiJ9.payload==.signature';
      const cookies = parseCookies(cookieHeader);

      expect(cookies.session).toBe('eyJhbGciOiJIUzI1NiJ9.payload==.signature');
    });

    it('should handle multiple cookies with base64 values', () => {
      const cookieHeader = 'atlas_session=payload==.sig; other=value=with=equals';
      const cookies = parseCookies(cookieHeader);

      expect(cookies.atlas_session).toBe('payload==.sig');
      expect(cookies.other).toBe('value=with=equals');
    });

    it('should return empty object for null header', () => {
      const cookies = parseCookies(null);
      expect(cookies).toEqual({});
    });
  });

  describe('Session round-trip with base64 padding', () => {
    it('should encode, cookie-ify, parse, and decode session with padding', () => {
      const sessionData = sampleSession(11);

      const encoded = encodeSession(sessionData);
      expect(encoded).toContain('.');

      const cookieString = createSessionCookie(sessionData);
      expect(cookieString).toContain('atlas_session=');
      expect(cookieString).toContain('HttpOnly');
      expect(cookieString).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);

      const cookieValueFromHeader = cookieValue(cookieString);
      const cookies = parseCookies(`atlas_session=${cookieValueFromHeader}`);

      expect(cookies.atlas_session).toBe(cookieValueFromHeader);
      expect(cookies.atlas_session).toContain('.');

      const decoded = decodeSession(cookies.atlas_session);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(11);
      expect(decoded?.sessionId).toBe(sessionData.sessionId);
      expect(decoded?.iat).toBe(sessionData.iat);
      expect(decoded?.exp).toBe(sessionData.exp);
    });

    it('should handle session with userId that produces no padding', () => {
      const sessionData = sampleSession(1);
      const cookieString = createSessionCookie(sessionData);
      const decoded = decodeSession(parseCookies(`atlas_session=${cookieValue(cookieString)}`).atlas_session);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(1);
    });

    it('should handle session with large userId', () => {
      const sessionData = sampleSession(999999);
      const cookieString = createSessionCookie(sessionData);
      const decoded = decodeSession(parseCookies(`atlas_session=${cookieValue(cookieString)}`).atlas_session);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(999999);
    });
  });

  describe('encodeSession and decodeSession', () => {
    it('should reject the legacy public HMAC fallback when SESSION_SECRET is missing', () => {
      const previous = process.env.SESSION_SECRET;
      delete process.env.SESSION_SECRET;

      try {
        expect(() => encodeSession(sampleSession(1))).toThrow('SESSION_SECRET es obligatorio');
      } finally {
        if (previous === undefined) {
          delete process.env.SESSION_SECRET;
        } else {
          process.env.SESSION_SECRET = previous;
        }
      }
    });

    it('should encode and decode session correctly', () => {
      const sessionData = sampleSession(42);
      const decoded = decodeSession(encodeSession(sessionData));

      expect(decoded).toEqual(sessionData);
    });

    it('issues a different sessionId for each payload', () => {
      const first = sampleSession(1);
      const second = sampleSession(1);
      expect(first.sessionId).not.toBe(second.sessionId);
    });

    it('rejects a cookie forged with the legacy public fallback secret', () => {
      const previous = process.env.SESSION_SECRET;
      process.env.SESSION_SECRET = 'dev-secret-change-in-production';
      const forged = encodeSession(sampleSession(999));
      process.env.SESSION_SECRET = previous ?? 'a-different-explicit-dev-session-secret-value';

      try {
        expect(decodeSession(forged)).toBeNull();
      } finally {
        if (previous === undefined) {
          delete process.env.SESSION_SECRET;
        } else {
          process.env.SESSION_SECRET = previous;
        }
      }
    });

    it('should return null for invalid session string', () => {
      expect(decodeSession('invalid')).toBeNull();
    });

    it('should return null for tampered signature', () => {
      const encoded = encodeSession(sampleSession(1));
      const [payload] = encoded.split('.');
      expect(decodeSession(`${payload}.wrongsignature`)).toBeNull();
    });

    it('rejects an expired payload even with a valid HMAC', () => {
      const now = Math.floor(Date.now() / 1000);
      const expired: SessionData = {
        userId: 3,
        sessionId: 'ab'.repeat(16),
        iat: now - 100,
        exp: now - 10,
      };

      expect(decodeSession(encodeSession(expired))).toBeNull();
    });

    it('rejects the legacy userId-only HMAC cookie', () => {
      const payload = Buffer.from(JSON.stringify({ userId: 1 })).toString('base64');
      const signature = createHmac('sha256', process.env.SESSION_SECRET ?? '')
        .update(payload)
        .digest('hex');

      expect(decodeSession(`${payload}.${signature}`)).toBeNull();
    });
  });
});
