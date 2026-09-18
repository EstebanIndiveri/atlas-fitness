import type { SessionData } from '@/types/auth';

export const SESSION_COOKIE_NAME = 'atlas_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const SESSION_CLOCK_SKEW_SECONDS = 60;
export const SESSION_ID_HEX_LENGTH = 32;

const SESSION_ID_PATTERN = /^[0-9a-f]{32}$/;

export function generateSessionId(): string {
  const bytes = new Uint8Array(SESSION_ID_HEX_LENGTH / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function buildSessionPayload(
  userId: number,
  nowMs: number = Date.now(),
  sessionId: string = generateSessionId(),
): SessionData {
  const iat = Math.floor(nowMs / 1000);
  return {
    userId,
    sessionId,
    iat,
    exp: iat + SESSION_MAX_AGE_SECONDS,
  };
}

export function timingSafeEqualHex(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return mismatch === 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Validates HMAC-decoded JSON. Rejects legacy `{ userId }` cookies and expired tokens.
 */
export function parseSessionPayload(
  data: unknown,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SessionData | null {
  if (data === null || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;
  const { userId, sessionId, iat, exp } = record;

  if (!isPositiveInteger(userId) || !isPositiveInteger(iat) || !isPositiveInteger(exp)) {
    return null;
  }

  if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
    return null;
  }

  if (exp <= iat) {
    return null;
  }

  if (exp - iat > SESSION_MAX_AGE_SECONDS + SESSION_CLOCK_SKEW_SECONDS) {
    return null;
  }

  if (iat > nowSeconds + SESSION_CLOCK_SKEW_SECONDS) {
    return null;
  }

  if (exp <= nowSeconds) {
    return null;
  }

  return { userId, sessionId, iat, exp };
}