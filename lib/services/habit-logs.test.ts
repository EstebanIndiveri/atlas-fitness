import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { habitLogs, users } from '@/lib/db/schema';
import {
  HABIT_KEYS,
  getHabitLogsForDate,
  getTodayHabitLogs,
  loadHabitActivityInWindow,
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

  it('persists a normalized quantitative amount for a quantitative habit', async () => {
    const log = await setHabitLog({
      userId,
      habitKey: 'hydration',
      done: true,
      amount: '1.50',
      now: MIDDAY_UTC,
    });

    expect(log.amount).toBe('1.5');
    expect(log.done).toBe(true);
  });

  it('clears the amount when a quantitative habit is toggled off', async () => {
    await setHabitLog({ userId, habitKey: 'hydration', done: true, amount: '1', now: MIDDAY_UTC });
    const cleared = await setHabitLog({
      userId,
      habitKey: 'hydration',
      done: false,
      now: MIDDAY_UTC,
    });

    expect(cleared.done).toBe(false);
    expect(cleared.amount).toBeNull();
  });

  it('rejects an out-of-range hydration amount', async () => {
    await expect(
      setHabitLog({ userId, habitKey: 'hydration', done: true, amount: '999', now: MIDDAY_UTC }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects an amount on a non-quantitative habit', async () => {
    await expect(
      setHabitLog({ userId, habitKey: 'walk', done: true, amount: '1', now: MIDDAY_UTC }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

/** 2026-09-01 … 2026-09-30, the window used by the bounded-loader tests. */
const WINDOW_START = '2026-09-01';
const WINDOW_END = '2026-09-30';
const WINDOW_DATES = Array.from(
  { length: 30 },
  (_, index) => `2026-09-${String(index + 1).padStart(2, '0')}`
);

/**
 * Reads a recorded `Client.execute` call into its SQL text and positional args.
 *
 * Drizzle always hands `@libsql/client` the parameterised object form; the guard keeps
 * the assertion honest if that ever changes.
 */
function readExecutedStatement(statement: unknown): { sql: string; args: readonly unknown[] } {
  if (
    typeof statement !== 'object' ||
    statement === null ||
    !('sql' in statement) ||
    typeof statement.sql !== 'string'
  ) {
    throw new Error(`Expected a parameterised statement, received: ${JSON.stringify(statement)}`);
  }

  const args = 'args' in statement && Array.isArray(statement.args) ? statement.args : [];

  return { sql: statement.sql, args };
}

describe('loadHabitActivityInWindow', () => {
  let userId: number;
  let otherUserId: number;

  beforeEach(async () => {
    await db.delete(habitLogs);
    await db.delete(users);

    const passwordHash = await bcrypt.hash('password123', 4);
    const inserted = await db
      .insert(users)
      .values([
        { name: 'Window User', email: 'window@example.com', passwordHash },
        { name: 'Other Window User', email: 'other-window@example.com', passwordHash },
      ])
      .returning();

    userId = inserted[0].id;
    otherUserId = inserted[1].id;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns only this user rows, with both window bounds inclusive', async () => {
    await db.insert(habitLogs).values([
      { userId, localDate: '2026-08-31', habitKey: 'walk', done: true },
      { userId, localDate: WINDOW_START, habitKey: 'walk', done: true },
      { userId, localDate: '2026-09-15', habitKey: 'walk', done: false },
      { userId, localDate: WINDOW_END, habitKey: 'walk', done: true },
      { userId, localDate: '2026-10-01', habitKey: 'walk', done: true },
      { userId: otherUserId, localDate: '2026-09-15', habitKey: 'walk', done: true },
    ]);

    const rows = await loadHabitActivityInWindow(userId, WINDOW_START, WINDOW_END);

    expect(rows.map((row) => `${row.localDate}:${row.habitKey}:${row.done}`)).toEqual([
      '2026-09-01:walk:true',
      '2026-09-15:walk:false',
      '2026-09-30:walk:true',
    ]);
    expect(rows.every((row) => row.userId === userId)).toBe(true);
  });

  it('issues exactly one user-scoped, date-bounded range query instead of a per-day or per-habit query', async () => {
    const rowsPerUser = WINDOW_DATES.length * HABIT_KEYS.length;
    await db.insert(habitLogs).values([
      ...WINDOW_DATES.flatMap((localDate) =>
        HABIT_KEYS.map((habitKey) => ({ userId, localDate, habitKey, done: true }))
      ),
      ...WINDOW_DATES.flatMap((localDate) =>
        HABIT_KEYS.map((habitKey) => ({ userId: otherUserId, localDate, habitKey, done: true }))
      ),
    ]);
    const executeSpy = jest.spyOn(db.$client, 'execute');

    const rows = await loadHabitActivityInWindow(userId, WINDOW_START, WINDOW_END);

    expect(rows).toHaveLength(rowsPerUser);
    expect(executeSpy).toHaveBeenCalledTimes(1);

    const { sql, args } = readExecutedStatement(executeSpy.mock.calls[0][0]);

    expect(sql).toMatch(/from "habit_logs" where/);
    expect(sql).toMatch(/"habit_logs"\."user_id" = \?/);
    expect(sql).toMatch(/"habit_logs"\."local_date" >= \?/);
    expect(sql).toMatch(/"habit_logs"\."local_date" <= \?/);
    expect(args).toEqual([userId, WINDOW_START, WINDOW_END]);
  });

  it('returns an empty list when the window holds no rows', async () => {
    await db
      .insert(habitLogs)
      .values([{ userId, localDate: '2026-07-15', habitKey: 'sleep', done: true }]);

    const rows = await loadHabitActivityInWindow(userId, WINDOW_START, WINDOW_END);

    expect(rows).toEqual([]);
  });
});
