import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db/client';
import { dailyCheckins } from '@/lib/db/schema';
import { cordobaLocalDate } from '@/lib/time/cordoba';
import { AppError } from '@/types/errors';
import type { DailyCheckin } from '@/lib/db/schema';

export const DAILY_CHECK_IN_NOTE_MAX_LENGTH = 500;

const recordDailyCheckInSchema = z.object({
  userId: z.number().int().positive(),
  mood: z.number().int().min(1).max(5),
  energy: z.enum(['low', 'medium', 'high']),
  note: z.string().max(DAILY_CHECK_IN_NOTE_MAX_LENGTH).nullable().optional(),
  now: z.date().optional(),
});

type ValidRecordDailyCheckInInput = z.infer<typeof recordDailyCheckInSchema>;

function parseRecordDailyCheckInInput(input: unknown): ValidRecordDailyCheckInInput {
  const parsed = recordDailyCheckInSchema.safeParse(input);

  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Daily check-in inválido');
  }

  return parsed.data;
}

/**
 * Records today's explicit check-in values in Córdoba local time.
 *
 * @param input - Unknown boundary payload validated with Zod before persistence.
 * @returns The created or updated DailyCheckin row.
 * @throws {AppError} VALIDATION when mood, energy, note, or userId are invalid.
 * @example
 * await recordDailyCheckIn({ userId: 1, mood: 4, energy: 'high', note: null });
 */
export async function recordDailyCheckIn(input: unknown): Promise<DailyCheckin> {
  const validInput = parseRecordDailyCheckInInput(input);
  const localDate = cordobaLocalDate(validInput.now);
  const now = new Date();

  const [checkIn] = await db
    .insert(dailyCheckins)
    .values({
      userId: validInput.userId,
      localDate,
      mood: validInput.mood,
      energy: validInput.energy,
      note: validInput.note ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [dailyCheckins.userId, dailyCheckins.localDate],
      set: {
        mood: validInput.mood,
        energy: validInput.energy,
        note: validInput.note ?? null,
        updatedAt: now,
      },
    })
    .returning();

  return checkIn;
}

/**
 * Gets the current user's check-in for the date containing `now` in Córdoba.
 *
 * @param userId - Authenticated user id.
 * @param now - Instant used to resolve the Córdoba local date.
 * @returns The DailyCheckin row for today, or null when absent.
 * @example
 * const checkIn = await getTodayCheckIn(1, new Date());
 */
export async function getTodayCheckIn(userId: number, now: Date = new Date()): Promise<DailyCheckin | null> {
  const localDate = cordobaLocalDate(now);
  const checkIn = await db.query.dailyCheckins.findFirst({
    where: and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.localDate, localDate)),
  });

  return checkIn ?? null;
}
