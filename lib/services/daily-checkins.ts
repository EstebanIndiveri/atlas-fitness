import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { dailyCheckins } from '@/lib/db/schema';
import { updateStreakFromActivity } from '@/lib/services/streaks';
import { AppError } from '@/types/errors';
import type { DailyCheckin } from '@/lib/db/schema';

/**
 * Validates mood value is in range 1-5
 */
function validateMood(mood: number): void {
  if (!Number.isInteger(mood) || mood < 1 || mood > 5) {
    throw new AppError('VALIDATION', 'El estado de ánimo debe estar entre 1 y 5');
  }
}

/**
 * Upserts a daily checkin (mood) for a user on a specific local date
 * Idempotent: creates new if missing, updates if exists
 */
export async function upsertDailyCheckin(
  userId: number,
  localDate: string,
  mood: number
): Promise<DailyCheckin> {
  validateMood(mood);

  // Try to find existing checkin
  const existing = await db.query.dailyCheckins.findFirst({
    where: and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.localDate, localDate)),
  });

  if (existing) {
    // Update existing
    const [updated] = await db
      .update(dailyCheckins)
      .set({
        mood,
        updatedAt: new Date(),
      })
      .where(eq(dailyCheckins.id, existing.id))
      .returning();

    await updateStreakFromActivity(userId);
    return updated;
  }

  // Create new
  try {
    const [checkin] = await db
      .insert(dailyCheckins)
      .values({
        userId,
        localDate,
        mood,
      })
      .returning();

    await updateStreakFromActivity(userId);
    return checkin;
  } catch (error) {
    // Handle race condition: another request inserted between our check and insert
    if (error instanceof Error) {
      const message = error.message;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const causeMessage = (error as any).cause?.message || '';

      if (message.includes('UNIQUE') || causeMessage.includes('UNIQUE')) {
        // Retry as update
        const [updated] = await db
          .update(dailyCheckins)
          .set({
            mood,
            updatedAt: new Date(),
          })
          .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.localDate, localDate)))
          .returning();

        await updateStreakFromActivity(userId);
        return updated;
      }
    }
    throw error;
  }
}

/**
 * Gets the daily checkin for a user on a specific date
 */
export async function getDailyCheckin(
  userId: number,
  localDate: string
): Promise<DailyCheckin | null> {
  const checkin = await db.query.dailyCheckins.findFirst({
    where: and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.localDate, localDate)),
  });

  return checkin || null;
}
