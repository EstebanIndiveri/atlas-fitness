import type { NextRequest } from 'next/server';

import { consumeRateLimitBucket } from '@/lib/services/rate-limit';
import { parsePositiveInt, resolveClientIp } from '@/lib/auth/rate-limit';

export const WEEKLY_PLAN_RATE_LIMIT_WINDOW_SECONDS = 60;
export const DEFAULT_WEEKLY_PLAN_GENERATE_LIMIT = 5;
export const MAX_WEEKLY_PLAN_GENERATE_LIMIT = 60;
export const WEEKLY_PLAN_RATE_LIMIT_MESSAGE =
  'Se alcanzó el límite de propuestas. Probá de nuevo en un minuto.';

/**
 * Reads the per-user/IP proposal quota, with a fixed hard ceiling.
 *
 * @param env Environment values that may override the local/production default.
 * @returns A requests-per-minute limit between 1 and 60.
 * @example
 * getWeeklyPlanGenerateLimit({ WEEKLY_PLAN_GENERATE_PER_MINUTE: '3' });
 */
export function getWeeklyPlanGenerateLimit(
  env: Record<string, string | undefined> = process.env,
): number {
  return Math.min(
    MAX_WEEKLY_PLAN_GENERATE_LIMIT,
    parsePositiveInt(env.WEEKLY_PLAN_GENERATE_PER_MINUTE, DEFAULT_WEEKLY_PLAN_GENERATE_LIMIT),
  );
}

/**
 * Creates a bounded durable-counter key scoped to the authenticated user and trusted client IP.
 *
 * @param userId Authenticated Atlas user id.
 * @param clientIp Normalized client IP from trusted proxy headers.
 * @returns A stable action/user/IP key for the fixed-window bucket.
 * @example
 * weeklyPlanGenerateRateLimitKey(42, '203.0.113.5');
 */
export function weeklyPlanGenerateRateLimitKey(userId: number, clientIp: string): string {
  return `weekly-plan-generate:${userId}:${clientIp}`;
}

/**
 * Enforces the durable per-user/IP quota before loading a catalog or calling Gemini.
 *
 * @param request Incoming request used to resolve the trusted client IP.
 * @param userId Authenticated user id from requireAuth.
 * @returns Resolves when the request is within quota.
 * @throws {AppError} RATE_LIMIT after the fixed-window quota is exceeded.
 * @example
 * await enforceWeeklyPlanGenerateRateLimit(request, session.userId);
 */
export async function enforceWeeklyPlanGenerateRateLimit(
  request: NextRequest,
  userId: number,
): Promise<void> {
  await consumeRateLimitBucket({
    key: weeklyPlanGenerateRateLimitKey(userId, resolveClientIp(request.headers)),
    limit: getWeeklyPlanGenerateLimit(),
    windowSeconds: WEEKLY_PLAN_RATE_LIMIT_WINDOW_SECONDS,
    message: WEEKLY_PLAN_RATE_LIMIT_MESSAGE,
  });
}
