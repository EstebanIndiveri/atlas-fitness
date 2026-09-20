import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { rateLimitBuckets } from '@/lib/db/schema';
import { AppError } from '@/types/errors';

export interface ConsumeRateLimitBucketInput {
  key: string;
  limit: number;
  windowSeconds: number;
  nowMs?: number;
  message: string;
}

export function windowStartSeconds(nowSeconds: number, windowSeconds: number): number {
  return nowSeconds - (nowSeconds % windowSeconds);
}

export function retryAfterSeconds(
  nowSeconds: number,
  windowStart: number,
  windowSeconds: number,
): number {
  return Math.max(1, windowStart + windowSeconds - nowSeconds);
}

/**
 * Fixed-window counter in `rate_limit_buckets` (Turso/SQLite).
 * Atomic upsert: increment when the stored window matches, otherwise reset to 1.
 */
export async function consumeRateLimitBucket(
  input: ConsumeRateLimitBucketInput,
): Promise<void> {
  const nowMs = input.nowMs ?? Date.now();
  const nowSeconds = Math.floor(nowMs / 1000);
  const windowStart = windowStartSeconds(nowSeconds, input.windowSeconds);

  const [row] = await db
    .insert(rateLimitBuckets)
    .values({
      key: input.key,
      windowStart,
      count: 1,
    })
    .onConflictDoUpdate({
      target: rateLimitBuckets.key,
      set: {
        count: sql`CASE WHEN ${rateLimitBuckets.windowStart} = ${windowStart} THEN ${rateLimitBuckets.count} + 1 ELSE 1 END`,
        windowStart,
      },
    })
    .returning({
      count: rateLimitBuckets.count,
      windowStart: rateLimitBuckets.windowStart,
    });

  if (!row) {
    throw new AppError('SERVICE_UNAVAILABLE', 'Servicio temporalmente no disponible');
  }

  if (row.count > input.limit) {
    throw new AppError(
      'RATE_LIMIT',
      input.message,
      retryAfterSeconds(nowSeconds, row.windowStart, input.windowSeconds),
    );
  }
}
