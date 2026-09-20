import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db/client';
import { habitLogs } from '@/lib/db/schema';
import { cordobaLocalDate } from '@/lib/time/cordoba';
import { HABIT_KEYS } from '@/types/habit';
import { AppError } from '@/types/errors';
import type { HabitLog } from '@/lib/db/schema';
import type { HabitKey } from '@/types/habit';

export { HABIT_KEYS };
export type { HabitKey };

const setHabitLogSchema = z.object({
  userId: z.number().int().positive(),
  habitKey: z.enum(HABIT_KEYS),
  done: z.boolean(),
  now: z.date().optional(),
});

type ValidSetHabitLogInput = z.infer<typeof setHabitLogSchema>;

function parseSetHabitLogInput(input: unknown): ValidSetHabitLogInput {
  const parsed = setHabitLogSchema.safeParse(input);

  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Registro de hábito inválido');
  }

  return parsed.data;
}

/**
 * Upserts today's completion state for a single habit in Córdoba local time.
 *
 * Idempotent on (userId, localDate, habitKey): repeated calls update the same row,
 * so a habit can be toggled on and off without creating duplicates.
 * @param input - Unknown boundary payload validated with Zod before persistence.
 * @returns The created or updated HabitLog row.
 * @throws {AppError} VALIDATION when habitKey, done, or userId are invalid.
 * @example
 * await setHabitLog({ userId: 1, habitKey: 'hydration', done: true });
 */
export async function setHabitLog(input: unknown): Promise<HabitLog> {
  const validInput = parseSetHabitLogInput(input);
  const localDate = cordobaLocalDate(validInput.now);
  const now = new Date();

  const [log] = await db
    .insert(habitLogs)
    .values({
      userId: validInput.userId,
      localDate,
      habitKey: validInput.habitKey,
      done: validInput.done,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [habitLogs.userId, habitLogs.localDate, habitLogs.habitKey],
      set: {
        done: validInput.done,
        updatedAt: now,
      },
    })
    .returning();

  return log;
}

/**
 * Lists a user's habit logs for an explicit Córdoba local date.
 *
 * @param userId - Authenticated user id.
 * @param localDate - Córdoba local date in YYYY-MM-DD format.
 * @returns The HabitLog rows for the date (empty array when none).
 * @example
 * const logs = await getHabitLogsForDate(1, '2026-09-17');
 */
export async function getHabitLogsForDate(userId: number, localDate: string): Promise<HabitLog[]> {
  return db.query.habitLogs.findMany({
    where: and(eq(habitLogs.userId, userId), eq(habitLogs.localDate, localDate)),
  });
}

/**
 * Lists the current user's habit logs for the date containing `now` in Córdoba.
 *
 * @param userId - Authenticated user id.
 * @param now - Instant used to resolve the Córdoba local date.
 * @returns The HabitLog rows for today (empty array when none).
 * @example
 * const logs = await getTodayHabitLogs(1, new Date());
 */
export async function getTodayHabitLogs(userId: number, now: Date = new Date()): Promise<HabitLog[]> {
  const localDate = cordobaLocalDate(now);
  return getHabitLogsForDate(userId, localDate);
}
