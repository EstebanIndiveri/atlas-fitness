import { describe, it, expect, beforeEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { habitLogs, users } from '@/lib/db/schema';
import {
  HABIT_KEYS,
  getHabitLogsForDate,
  getTodayHabitLogs,
  setHabitLog,
} from '@/lib/services/habit-logs';
import { AppError } from '@/types/errors';

// 2026-09-17T02:00:00Z is 2026-09-16T23:00 in Córdoba (UTC-3): local date is the 16th.
const LATE_NIGHT_UTC = new Date('2026-09-17T02:00:00.000Z');
const LATE_NIGHT_LOCAL_DATE = '2026-09-16';
const MIDDAY_UTC = new Date('2026-09-17T15:00:00.000Z');
const MIDDAY_LOCAL_DATE = '2026-09-17';

describe('HabitLogs service', () => {
  let userId: number;

  beforeEach(async () => {
    await db.delete(habitLogs);
    await db.delete(users);

    const passwordHash = await bcrypt.hash('password123', 4);
    const [user] = await db
      .insert(users)
      .values({ name: 'Habits User', email: 'habits@example.com', passwordHash })
      .returning();
    userId = user.id;
  });

  it('exposes the honest habit catalog keys', () => {
    expect(HABIT_KEYS).toEqual(['hydration', 'walk', 'mobility', 'sleep']);
  });

  it('records a completed habit for the current Córdoba local date', async () => {
    const log = await setHabitLog({ userId, habitKey: 'hydration', done: true, now: MIDDAY_UTC });

    expect(log.userId).toBe(userId);
    expect(log.habitKey).toBe('hydration');
    expect(log.done).toBe(true);
    expect(log.localDate).toBe(MIDDAY_LOCAL_DATE);
  });

  it('resolves "today" in Córdoba time near midnight (not UTC)', async () => {
    await setHabitLog({ userId, habitKey: 'sleep', done: true, now: LATE_NIGHT_UTC });

    const logs = await getHabitLogsForDate(userId, LATE_NIGHT_LOCAL_DATE);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.habitKey).toBe('sleep');
  });

  it('upserts idempotently and can toggle a habit off without duplicating rows', async () => {
    await setHabitLog({ userId, habitKey: 'walk', done: true, now: MIDDAY_UTC });
    const toggledOff = await setHabitLog({ userId, habitKey: 'walk', done: false, now: MIDDAY_UTC });

    expect(toggledOff.done).toBe(false);

    const rows = await db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.userId, userId), eq(habitLogs.habitKey, 'walk')));
    expect(rows).toHaveLength(1);
  });

  it('lists every habit logged for a date and returns an empty array when none exist', async () => {
    await setHabitLog({ userId, habitKey: 'hydration', done: true, now: MIDDAY_UTC });
    await setHabitLog({ userId, habitKey: 'mobility', done: true, now: MIDDAY_UTC });

    const logged = await getHabitLogsForDate(userId, MIDDAY_LOCAL_DATE);
    expect(logged.map((row) => row.habitKey).sort()).toEqual(['hydration', 'mobility']);

    const empty = await getHabitLogsForDate(userId, '2020-01-01');
    expect(empty).toEqual([]);
  });

  it('reads today\'s logs using the Córdoba local date', async () => {
    await setHabitLog({ userId, habitKey: 'sleep', done: true, now: MIDDAY_UTC });

    const logs = await getTodayHabitLogs(userId, MIDDAY_UTC);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.habitKey).toBe('sleep');
  });

  it('rejects an unknown habit key', async () => {
    await expect(
      setHabitLog({ userId, habitKey: 'meditation', done: true, now: MIDDAY_UTC }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects a non-boolean done value', async () => {
    await expect(
      setHabitLog({ userId, habitKey: 'walk', done: 'yes', now: MIDDAY_UTC }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects an invalid userId', async () => {
    await expect(
      setHabitLog({ userId: 0, habitKey: 'walk', done: true, now: MIDDAY_UTC }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
