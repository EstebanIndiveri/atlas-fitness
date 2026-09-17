import type { SessionData } from '@/types/auth';

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
const SESSION_COOKIE_NAME = 'atlas_session';

/**
 * Creates an HMAC signature for data using Web Crypto API (Edge compatible)
 */
async function createSignature(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SESSION_SECRET);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies an HMAC signature using Web Crypto API (Edge compatible)
 */
async function verifySignature(data: string, signature: string): Promise<boolean> {
  const expectedSignature = await createSignature(data);
  return expectedSignature === signature;
}

/**
 * Base64 decode helper (Edge compatible)
 */
function base64Decode(str: string): string {
  try {
    // In Edge runtime, atob is available
    return atob(str);
  } catch {
    // Fallback for Node.js environment during build
    return Buffer.from(str, 'base64').toString('utf-8');
  }
}

/**
 * Decodes and verifies a session cookie value (async for Edge compatibility)
 */
export async function decodeSessionEdge(cookieValue: string): Promise<SessionData | null> {
  try {
    const [payload, signature] = cookieValue.split('.');
    if (!payload || !signature) {
      console.log('[Session] Invalid cookie format - missing payload or signature');
      return null;
    }

    const isValid = await verifySignature(payload, signature);
    if (!isValid) {
      console.log('[Session] Invalid signature');
      return null;
    }

    const decoded = base64Decode(payload);
    const data = JSON.parse(decoded);
    console.log('[Session] Successfully decoded session:', data);
    return data;
  } catch (error) {
    console.log('[Session] Error decoding:', error);
    return null;
  }
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
 * Gets session data from request cookies (async for Edge compatibility)
 */
export async function getSessionFromCookiesEdge(
  cookieHeader: string | null,
): Promise<SessionData | null> {
  const cookies = parseCookies(cookieHeader);
  const sessionCookie = cookies[SESSION_COOKIE_NAME];

  if (!sessionCookie) {
    return null;
  }

  return decodeSessionEdge(sessionCookie);
}

export { SESSION_COOKIE_NAME };
