import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db/client';
import { habitLogs } from '@/lib/db/schema';
import { isValidHydrationLiters, parseHydrationLiters } from '@/lib/format/hydration';
import { cordobaLocalDate } from '@/lib/time/cordoba';
import { HABIT_KEYS, isQuantitativeHabitKey } from '@/types/habit';
import { AppError } from '@/types/errors';
import type { HabitLog } from '@/lib/db/schema';
import type { HabitKey } from '@/types/habit';

export { HABIT_KEYS };
export type { HabitKey };

const setHabitLogSchema = z
  .object({
    userId: z.number().int().positive(),
    habitKey: z.enum(HABIT_KEYS),
    done: z.boolean(),
    amount: z.string().optional(),
    now: z.date().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.amount === undefined) {
      return;
    }

    if (!isQuantitativeHabitKey(value.habitKey)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Hábito sin cantidad', path: ['amount'] });
      return;
    }

    if (!isValidHydrationLiters(value.amount)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cantidad inválida', path: ['amount'] });
    }
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
 * so a habit can be toggled on and off without creating duplicates. Quantitative
 * habits (e.g. hydration) may carry a user-entered `amount` (liters decimal string),
 * which is normalized on save and cleared when the habit is toggled off.
 * @param input - Unknown boundary payload validated with Zod before persistence.
 * @returns The created or updated HabitLog row.
 * @throws {AppError} VALIDATION when habitKey, done, userId, or amount are invalid.
 * @example
 * await setHabitLog({ userId: 1, habitKey: 'hydration', done: true, amount: '1.5' });
 */
export async function setHabitLog(input: unknown): Promise<HabitLog> {
  const validInput = parseSetHabitLogInput(input);
  const localDate = cordobaLocalDate(validInput.now);
  const now = new Date();

  const amount =
    validInput.done && validInput.amount !== undefined
      ? parseHydrationLiters(validInput.amount)
      : null;

  const [log] = await db
    .insert(habitLogs)
    .values({
      userId: validInput.userId,
      localDate,
      habitKey: validInput.habitKey,
      done: validInput.done,
      amount,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [habitLogs.userId, habitLogs.localDate, habitLogs.habitKey],
      set: {
        done: validInput.done,
        amount,
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

/**
 * Lists one user's habit logs inside an inclusive Córdoba date window.
 *
 * Exactly one user-scoped, date-bounded range query covers the whole window, and the rows
 * are grouped by callers in a single in-memory pass: no per-day and no per-habit read, so a
 * 90-day window costs the same one query as a single day. `loadActiveDates` must NOT be
 * reused here — it answers a different question (it excludes habits, so habit activity is
 * invisible to it) and it is unbounded, loading every ended workout and check-in the user
 * ever created. Do not "unify" the two helpers.
 * @param userId - Authenticated owner of the logs.
 * @param windowStart - Inclusive Córdoba start date in YYYY-MM-DD format.
 * @param windowEnd - Inclusive Córdoba end date in YYYY-MM-DD format.
 * @returns The HabitLog rows inside the window, explicitly ordered ascending by local date
 * (empty array when none). The order is guaranteed by this loader's own `ORDER BY`, not by the
 * index scan, so callers may rely on it whatever query plan the engine picks.
 * @example
 * const logs = await loadHabitActivityInWindow(1, '2026-09-21', '2026-09-27');
 */
export async function loadHabitActivityInWindow(
  userId: number,
  windowStart: string,
  windowEnd: string,
): Promise<HabitLog[]> {
  return db
    .select()
    .from(habitLogs)
    .where(
      and(
        eq(habitLogs.userId, userId),
        gte(habitLogs.localDate, windowStart),
        lte(habitLogs.localDate, windowEnd),
      ),
    )
    .orderBy(asc(habitLogs.localDate));
}
