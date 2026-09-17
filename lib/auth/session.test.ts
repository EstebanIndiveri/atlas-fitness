import { describe, it, expect } from '@jest/globals';
import { encodeSession, decodeSession, createSessionCookie, parseCookies } from './session';
import type { SessionData } from '@/types/auth';

describe('Session utilities', () => {
  describe('parseCookies', () => {
    it('should parse simple cookies', () => {
      const cookieHeader = 'name=value; other=test';
      const cookies = parseCookies(cookieHeader);

      expect(cookies.name).toBe('value');
      expect(cookies.other).toBe('test');
    });

    it('should handle cookies with base64 padding (=)', () => {
      // Base64 values can end with = or == for padding
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
      // Create a session data that will produce base64 with = padding
      // userId: 1 produces eyJ1c2VySWQiOjF9 (no padding)
      // userId: 11 produces eyJ1c2VySWQiOjExfQ== (with == padding)
      const sessionData: SessionData = { userId: 11 };

      // Encode session
      const encoded = encodeSession(sessionData);
      expect(encoded).toContain('.');

      // Create cookie string
      const cookieString = createSessionCookie(sessionData);
      expect(cookieString).toContain('atlas_session=');
      expect(cookieString).toContain('HttpOnly');

      // Extract just the cookie value from the Set-Cookie header
      const match = cookieString.match(/atlas_session=([^;]+)/);
      expect(match).not.toBeNull();
      const cookieValue = match![1];

      // Parse cookies from header (simulating browser sending it back)
      const cookieHeader = `atlas_session=${cookieValue}`;
      const cookies = parseCookies(cookieHeader);

      expect(cookies.atlas_session).toBe(cookieValue);
      expect(cookies.atlas_session).toContain('.');

      // Decode session
      const decoded = decodeSession(cookies.atlas_session);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(11);
    });

    it('should handle session with userId that produces no padding', () => {
      const sessionData: SessionData = { userId: 1 };

      const cookieString = createSessionCookie(sessionData);
      const match = cookieString.match(/atlas_session=([^;]+)/);
      const cookieValue = match![1];

      const cookies = parseCookies(`atlas_session=${cookieValue}`);
      const decoded = decodeSession(cookies.atlas_session);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(1);
    });

    it('should handle session with large userId', () => {
      const sessionData: SessionData = { userId: 999999 };

      const cookieString = createSessionCookie(sessionData);
      const match = cookieString.match(/atlas_session=([^;]+)/);
      const cookieValue = match![1];

      const cookies = parseCookies(`atlas_session=${cookieValue}`);
      const decoded = decodeSession(cookies.atlas_session);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(999999);
    });
  });

  describe('encodeSession and decodeSession', () => {
    it('should encode and decode session correctly', () => {
      const sessionData: SessionData = { userId: 42 };

      const encoded = encodeSession(sessionData);
      const decoded = decodeSession(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(42);
    });

    it('should return null for invalid session string', () => {
      const decoded = decodeSession('invalid');
      expect(decoded).toBeNull();
    });

    it('should return null for tampered signature', () => {
      const sessionData: SessionData = { userId: 1 };
      const encoded = encodeSession(sessionData);

      // Tamper with signature
      const [payload] = encoded.split('.');
      const tampered = `${payload}.wrongsignature`;

      const decoded = decodeSession(tampered);
      expect(decoded).toBeNull();
    });
  });
});
