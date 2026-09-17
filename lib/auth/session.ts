import { createHmac, randomBytes } from 'crypto';
import type { SessionData } from '@/types/auth';

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
const SESSION_COOKIE_NAME = 'atlas_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Creates an HMAC signature for data
 */
function createSignature(data: string): string {
  return createHmac('sha256', SESSION_SECRET).update(data).digest('hex');
}

/**
 * Verifies an HMAC signature
 */
function verifySignature(data: string, signature: string): boolean {
  const expectedSignature = createSignature(data);
  return expectedSignature === signature;
}

/**
 * Encodes session data into a signed cookie value
 */
export function encodeSession(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64');
  const signature = createSignature(payload);
  return `${payload}.${signature}`;
}

/**
 * Decodes and verifies a session cookie value
 */
export function decodeSession(cookieValue: string): SessionData | null {
  try {
    const [payload, signature] = cookieValue.split('.');
    if (!payload || !signature) {
      return null;
    }

    if (!verifySignature(payload, signature)) {
      return null;
    }

    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
    return data;
  } catch {
    return null;
  }
}

/**
 * Creates session cookie string
 */
export function createSessionCookie(data: SessionData): string {
  const value = encodeSession(data);
  const maxAge = SESSION_MAX_AGE;
  const sameSite = 'lax';
  const secure = process.env.NODE_ENV === 'production';

  return `${SESSION_COOKIE_NAME}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=${sameSite}${secure ? '; Secure' : ''}`;
}

/**
 * Creates a cookie string to clear the session
 */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly`;
}

/**
 * Parses cookies from request headers
 */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, string>,
  );
}

/**
 * Gets session data from request cookies
 */
export function getSessionFromCookies(cookieHeader: string | null): SessionData | null {
  const cookies = parseCookies(cookieHeader);
  const sessionCookie = cookies[SESSION_COOKIE_NAME];

  if (!sessionCookie) {
    return null;
  }

  return decodeSession(sessionCookie);
}

export { SESSION_COOKIE_NAME };
