import { describe, expect, it } from '@jest/globals';
import {
  AUTH_RATE_LIMIT_MESSAGE,
  DEFAULT_AUTH_RATE_LIMITS,
  UNKNOWN_CLIENT_IP,
  authRateLimitKey,
  firstForwardedHop,
  getAuthRateLimit,
  normalizeIp,
  parsePositiveInt,
  resolveClientIp,
} from './rate-limit';

describe('resolveClientIp', () => {
  it('uses the first x-forwarded-for hop and ignores later hops', () => {
    const headers = new Headers({
      'x-forwarded-for': ' 203.0.113.10, 10.0.0.1, 127.0.0.1 ',
      'x-real-ip': '198.51.100.9',
    });

    expect(resolveClientIp(headers)).toBe('203.0.113.10');
  });

  it('falls back to x-real-ip when x-forwarded-for is missing', () => {
    const headers = new Headers({ 'x-real-ip': '198.51.100.9' });
    expect(resolveClientIp(headers)).toBe('198.51.100.9');
  });

  it('uses unknown when no trusted proxy headers are present', () => {
    expect(resolveClientIp(new Headers())).toBe(UNKNOWN_CLIENT_IP);
  });

  it('strips IPv4 :port and bracketed IPv6', () => {
    expect(normalizeIp('203.0.113.10:443')).toBe('203.0.113.10');
    expect(normalizeIp('[2001:db8::1]:443')).toBe('2001:db8::1');
    expect(firstForwardedHop('2001:db8::1, 10.0.0.1')).toBe('2001:db8::1');
  });
});

describe('auth rate-limit policy', () => {
  it('keeps login and register keys separate for the same IP', () => {
    expect(authRateLimitKey('login', '203.0.113.10')).toBe('login:203.0.113.10');
    expect(authRateLimitKey('register', '203.0.113.10')).toBe('register:203.0.113.10');
  });

  it('defaults to 10 login and 5 register per minute', () => {
    expect(getAuthRateLimit('login', {})).toBe(DEFAULT_AUTH_RATE_LIMITS.login);
    expect(getAuthRateLimit('register', {})).toBe(DEFAULT_AUTH_RATE_LIMITS.register);
    expect(DEFAULT_AUTH_RATE_LIMITS).toEqual({ login: 10, register: 5 });
  });

  it('reads positive env overrides and ignores invalid values', () => {
    expect(
      getAuthRateLimit('login', { AUTH_RATE_LIMIT_LOGIN_PER_MINUTE: '3' }),
    ).toBe(3);
    expect(
      getAuthRateLimit('register', { AUTH_RATE_LIMIT_REGISTER_PER_MINUTE: '0' }),
    ).toBe(5);
    expect(parsePositiveInt('nope', 10)).toBe(10);
  });

  it('uses a generic Spanish message that does not leak user existence', () => {
    expect(AUTH_RATE_LIMIT_MESSAGE).toMatch(/intentos/i);
    expect(AUTH_RATE_LIMIT_MESSAGE.toLowerCase()).not.toContain('email');
    expect(AUTH_RATE_LIMIT_MESSAGE.toLowerCase()).not.toContain('usuario');
  });
});
