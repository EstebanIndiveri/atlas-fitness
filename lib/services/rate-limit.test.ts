/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { consumeRateLimitBucket, retryAfterSeconds, windowStartSeconds } from './rate-limit';
import { db } from '@/lib/db/client';
import { rateLimitBuckets } from '@/lib/db/schema';
import { AppError } from '@/types/errors';

const MESSAGE = 'Demasiados intentos. Probá de nuevo en un momento.';
const WINDOW_SECONDS = 60;
const NOW_MS = 1_800_000_030_000; // 30s into a 60s window

async function countFor(key: string): Promise<number | undefined> {
  const [row] = await db
    .select({ count: rateLimitBuckets.count, windowStart: rateLimitBuckets.windowStart })
    .from(rateLimitBuckets)
    .where(eq(rateLimitBuckets.key, key))
    .limit(1);
  return row?.count;
}

describe('consumeRateLimitBucket', () => {
  beforeEach(async () => {
    await db.delete(rateLimitBuckets);
  });

  it('allows requests under the limit and persists the count', async () => {
    await consumeRateLimitBucket({
      key: 'login:203.0.113.10',
      limit: 2,
      windowSeconds: WINDOW_SECONDS,
      nowMs: NOW_MS,
      message: MESSAGE,
    });
    await consumeRateLimitBucket({
      key: 'login:203.0.113.10',
      limit: 2,
      windowSeconds: WINDOW_SECONDS,
      nowMs: NOW_MS,
      message: MESSAGE,
    });

    expect(await countFor('login:203.0.113.10')).toBe(2);
  });

  it('throws RATE_LIMIT with retryAfterSeconds when over the limit', async () => {
    const input = {
      key: 'login:203.0.113.10',
      limit: 2,
      windowSeconds: WINDOW_SECONDS,
      nowMs: NOW_MS,
      message: MESSAGE,
    };

    await consumeRateLimitBucket(input);
    await consumeRateLimitBucket(input);

    try {
      await consumeRateLimitBucket(input);
      throw new Error('expected AppError');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        code: 'RATE_LIMIT',
        message: MESSAGE,
        retryAfterSeconds: 30,
      });
    }

    expect(await countFor('login:203.0.113.10')).toBe(3);
  });

  it('isolates different keys (IPs and actions)', async () => {
    const base = {
      limit: 1,
      windowSeconds: WINDOW_SECONDS,
      nowMs: NOW_MS,
      message: MESSAGE,
    };

    await consumeRateLimitBucket({ ...base, key: 'login:203.0.113.10' });
    await consumeRateLimitBucket({ ...base, key: 'login:198.51.100.9' });
    await consumeRateLimitBucket({ ...base, key: 'register:203.0.113.10' });

    await expect(
      consumeRateLimitBucket({ ...base, key: 'login:203.0.113.10' }),
    ).rejects.toMatchObject({ code: 'RATE_LIMIT' });

    expect(await countFor('login:198.51.100.9')).toBe(1);
    expect(await countFor('register:203.0.113.10')).toBe(1);
  });

  it('resets the count when the fixed window rolls over', async () => {
    const key = 'login:203.0.113.10';
    await consumeRateLimitBucket({
      key,
      limit: 1,
      windowSeconds: WINDOW_SECONDS,
      nowMs: NOW_MS,
      message: MESSAGE,
    });
    await expect(
      consumeRateLimitBucket({
        key,
        limit: 1,
        windowSeconds: WINDOW_SECONDS,
        nowMs: NOW_MS,
        message: MESSAGE,
      }),
    ).rejects.toMatchObject({ code: 'RATE_LIMIT' });

    await consumeRateLimitBucket({
      key,
      limit: 1,
      windowSeconds: WINDOW_SECONDS,
      nowMs: NOW_MS + 60_000,
      message: MESSAGE,
    });

    expect(await countFor(key)).toBe(1);
  });

  it('computes window start and Retry-After for a fixed window', () => {
    expect(windowStartSeconds(1_800_000_030, 60)).toBe(1_800_000_000);
    expect(retryAfterSeconds(1_800_000_030, 1_800_000_000, 60)).toBe(30);
    expect(retryAfterSeconds(1_800_000_000, 1_800_000_000, 60)).toBe(60);
  });
});
