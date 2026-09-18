import { describe, expect, it } from '@jest/globals';
import {
  SESSION_MAX_AGE_SECONDS,
  buildSessionPayload,
  generateSessionId,
  parseSessionPayload,
  timingSafeEqualHex,
} from './session-payload';

const NOW = 1_800_000_000;

function validPayload() {
  return {
    userId: 7,
    sessionId: '0123456789abcdef0123456789abcdef',
    iat: NOW - 60,
    exp: NOW - 60 + SESSION_MAX_AGE_SECONDS,
  };
}

describe('session payload', () => {
  it('generates unique 32-char hex sessionIds', () => {
    const ids = new Set(Array.from({ length: 8 }, () => generateSessionId()));

    expect(ids.size).toBe(8);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it('builds iat/exp aligned to the 7-day cookie lifetime', () => {
    const payload = buildSessionPayload(11, NOW * 1000, 'aa'.repeat(16));

    expect(payload).toEqual({
      userId: 11,
      sessionId: 'aa'.repeat(16),
      iat: NOW,
      exp: NOW + SESSION_MAX_AGE_SECONDS,
    });
  });

  it('accepts a complete unexpired payload', () => {
    expect(parseSessionPayload(validPayload(), NOW)).toEqual(validPayload());
  });

  it('rejects the legacy userId-only payload', () => {
    expect(parseSessionPayload({ userId: 1 }, NOW)).toBeNull();
  });

  it('rejects missing, expired, and overlong tokens', () => {
    const base = validPayload();

    expect(parseSessionPayload({ ...base, sessionId: undefined }, NOW)).toBeNull();
    expect(parseSessionPayload({ ...base, exp: NOW }, NOW)).toBeNull();
    expect(parseSessionPayload({ ...base, exp: NOW - 1 }, NOW)).toBeNull();
    expect(
      parseSessionPayload(
        { ...base, iat: NOW, exp: NOW + SESSION_MAX_AGE_SECONDS + 120 },
        NOW,
      ),
    ).toBeNull();
    expect(parseSessionPayload({ ...base, iat: NOW + 120 }, NOW)).toBeNull();
    expect(parseSessionPayload({ ...base, sessionId: 'not-hex' }, NOW)).toBeNull();
    expect(parseSessionPayload({ ...base, userId: 0 }, NOW)).toBeNull();
  });

  it('compares hex signatures in constant-time length-equal form', () => {
    expect(timingSafeEqualHex('abcd', 'abcd')).toBe(true);
    expect(timingSafeEqualHex('abcd', 'abce')).toBe(false);
    expect(timingSafeEqualHex('abcd', 'abc')).toBe(false);
  });
});