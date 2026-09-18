import type { NextRequest } from 'next/server';
import { consumeRateLimitBucket } from '@/lib/services/rate-limit';

export type AuthRateLimitAction = 'login' | 'register';

export const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;

export const DEFAULT_AUTH_RATE_LIMITS = {
  login: 10,
  register: 5,
} as const satisfies Record<AuthRateLimitAction, number>;

const LIMIT_ENV_KEYS = {
  login: 'AUTH_RATE_LIMIT_LOGIN_PER_MINUTE',
  register: 'AUTH_RATE_LIMIT_REGISTER_PER_MINUTE',
} as const satisfies Record<AuthRateLimitAction, string>;

/** Generic es-AR copy — never reveals whether the email/user exists. */
export const AUTH_RATE_LIMIT_MESSAGE = 'Demasiados intentos. Probá de nuevo en un momento.';

export const UNKNOWN_CLIENT_IP = 'unknown';

/**
 * Resolves the client IP from trusted proxy headers.
 *
 * Assumptions (Vercel):
 * - The platform overwrites `x-forwarded-for` / `x-real-ip`. Leftmost
 *   `x-forwarded-for` hop is the original client.
 * - Later hops are ignored (do not let a client-spoofed extra hop win).
 * - A custom proxy in front of Vercel can poison the leftmost hop; that
 *   topology is out of scope.
 * - Missing headers share the `unknown` bucket (fail closed-ish).
 */
export function resolveClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const firstHop = firstForwardedHop(forwarded);
    if (firstHop) {
      return firstHop;
    }
  }

  const realIp = normalizeIp(headers.get('x-real-ip'));
  if (realIp) {
    return realIp;
  }

  return UNKNOWN_CLIENT_IP;
}

export function firstForwardedHop(value: string): string | null {
  const [raw] = value.split(',');
  return normalizeIp(raw);
}

export function normalizeIp(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  let ip = value.trim();
  if (ip.length === 0 || ip.length > 128) {
    return null;
  }

  if (ip.startsWith('[')) {
    const end = ip.indexOf(']');
    if (end > 1) {
      ip = ip.slice(1, end);
    }
  } else if (isIpv4WithPort(ip)) {
    ip = ip.slice(0, ip.lastIndexOf(':'));
  }

  ip = ip.trim().toLowerCase();
  return ip.length > 0 ? ip : null;
}

function isIpv4WithPort(value: string): boolean {
  const colon = value.lastIndexOf(':');
  if (colon <= 0) {
    return false;
  }
  const host = value.slice(0, colon);
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

export function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAuthRateLimit(
  action: AuthRateLimitAction,
  env: Record<string, string | undefined> = process.env,
): number {
  return parsePositiveInt(env[LIMIT_ENV_KEYS[action]], DEFAULT_AUTH_RATE_LIMITS[action]);
}

export function authRateLimitKey(action: AuthRateLimitAction, clientIp: string): string {
  return `${action}:${clientIp}`;
}

/**
 * Shared entry point for auth routes. Counts this request against IP + action.
 */
export async function enforceAuthRateLimit(
  request: NextRequest,
  action: AuthRateLimitAction,
): Promise<void> {
  await consumeRateLimitBucket({
    key: authRateLimitKey(action, resolveClientIp(request.headers)),
    limit: getAuthRateLimit(action),
    windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    message: AUTH_RATE_LIMIT_MESSAGE,
  });
}
