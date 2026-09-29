import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { habitLogs, habitTargetDays, habitTargetSchedules, users } from '@/lib/db/schema';
import { isUniqueConstraintError } from '@/lib/db/unique-error';
import { assertValidHabitTargetSchedules } from '@/lib/services/habit-target-adherence';
import {
  deactivateHabitTarget,
  listCurrentHabitTargets,
  loadHabitTargetVersionsInWindow,
  putHabitTarget,
} from '@/lib/services/habit-targets';
import type { HabitKey } from '@/types/habit';
import type { HabitTargetWeekday } from '@/types/habit-target';

// 2026-09-17T15:00:00Z is 2026-09-17 12:00 in Córdoba (UTC-3): a Thursday (weekday 4).
const MIDDAY_UTC = new Date('2026-09-17T15:00:00.000Z');
const MIDDAY_LOCAL_DATE = '2026-09-17';
// 2026-09-18T15:00:00Z is 2026-09-18 12:00 in Córdoba: a Friday (weekday 5).
const NEXT_DAY_UTC = new Date('2026-09-18T15:00:00.000Z');
const NEXT_DAY_LOCAL_DATE = '2026-09-18';
// 2026-09-17T02:00:00Z is 2026-09-16 23:00 in Córdoba: local date is still the 16th.
const LATE_NIGHT_UTC = new Date('2026-09-17T02:00:00.000Z');
const LATE_NIGHT_LOCAL_DATE = '2026-09-16';

const CREATE = { expectedTargetId: null, expectedVersion: null } as const;

function put(
  userId: number,
  habitKey: HabitKey,
  weekdays: HabitTargetWeekday[],
  token: { expectedTargetId: number | null; expectedVersion: number | null },
  now: Date,
) {
  return putHabitTarget(userId, habitKey, { weekdays, ...token }, now);
}

describe('habit-targets service', () => {
  let userId: number;
  let otherUserId: number;

  beforeEach(async () => {
    await db.delete(habitTargetDays);
    await db.delete(habitTargetSchedules);
    await db.delete(habitLogs);
    await db.delete(users);

    const passwordHash = await bcrypt.hash('password123', 4);
    const inserted = await db
      .insert(users)
      .values([
        { name: 'Target User', email: 'target@example.com', passwordHash },
        { name: 'Other Target User', email: 'other-target@example.com', passwordHash },
      ])
      .returning();

    userId = inserted[0]!.id;
    otherUserId = inserted[1]!.id;
  });

  describe('create and read', () => {
    it('returns no current targets for a fresh user', async () => {
      expect(await listCurrentHabitTargets(userId, MIDDAY_UTC)).toEqual([]);
    });

    it('creates the first version effective today in Córdoba', async () => {
      const target = await put(userId, 'walk', [1, 3], CREATE, MIDDAY_UTC);

      expect(target).toMatchObject({
        userId,
        habitKey: 'walk',
        effectiveFrom: MIDDAY_LOCAL_DATE,
        effectiveTo: null,
        version: 1,
        weekdays: [1, 3],
      });

      const rows = await db.select().from(habitTargetSchedules);
      expect(rows).toHaveLength(1);
      const days = await db.select().from(habitTargetDays);
      expect(days.map((day) => day.dayOfWeek).sort()).toEqual([1, 3]);
      expect(days.every((day) => day.scheduleId === target.id)).toBe(true);
    });

    it('resolves the effective date in Córdoba near midnight, not UTC', async () => {
      const target = await put(userId, 'sleep', [0], CREATE, LATE_NIGHT_UTC);

      expect(target.effectiveFrom).toBe(LATE_NIGHT_LOCAL_DATE);
    });

    it('lists only configured habits in catalog order', async () => {
      await put(userId, 'walk', [1], CREATE, MIDDAY_UTC);
      await put(userId, 'hydration', [2], CREATE, MIDDAY_UTC);

      const targets = await listCurrentHabitTargets(userId, MIDDAY_UTC);
      expect(targets.map((target) => target.habitKey)).toEqual(['hydration', 'walk']);
    });

    it('rejects an unknown catalog habit as NOT_FOUND', async () => {
      await expect(
        putHabitTarget(
          userId,
          'meditation' as HabitKey,
          { weekdays: [1], ...CREATE },
          MIDDAY_UTC,
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it.each([
      ['empty', [] as HabitTargetWeekday[]],
      ['out of range', [7] as unknown as HabitTargetWeekday[]],
      ['negative', [-1] as unknown as HabitTargetWeekday[]],
      ['duplicated', [1, 1] as HabitTargetWeekday[]],
      ['non-integer', [1.5] as unknown as HabitTargetWeekday[]],
    ])('rejects an %s weekday selection as VALIDATION', async (_label, weekdays) => {
      await expect(put(userId, 'walk', weekdays, CREATE, MIDDAY_UTC)).rejects.toMatchObject({
        code: 'VALIDATION',
      });
      expect(await db.select().from(habitTargetSchedules)).toHaveLength(0);
    });

    it('rejects a half-provided concurrency token as VALIDATION', async () => {
      await expect(
        put(userId, 'walk', [1], { expectedTargetId: 4, expectedVersion: null }, MIDDAY_UTC),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('isolates users: another user cannot read or write the first user targets', async () => {
      const created = await put(userId, 'walk', [1], CREATE, MIDDAY_UTC);

      expect(await listCurrentHabitTargets(otherUserId, MIDDAY_UTC)).toEqual([]);
      await expect(
        put(
          otherUserId,
          'walk',
          [2],
          { expectedTargetId: created.id, expectedVersion: created.version },
          MIDDAY_UTC,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(await db.select().from(habitTargetSchedules)).toHaveLength(1);
    });
  });

  describe('same-day updates', () => {
    it('updates days in place and increments the version instead of creating another row', async () => {
      const created = await put(userId, 'walk', [1], CREATE, MIDDAY_UTC);
      const edited = await put(
        userId,
        'walk',
        [2, 4],
        { expectedTargetId: created.id, expectedVersion: created.version },
        MIDDAY_UTC,
      );

      expect(edited.id).toBe(created.id);
      expect(edited.version).toBe(2);
      expect(edited.effectiveFrom).toBe(MIDDAY_LOCAL_DATE);
      expect(edited.weekdays).toEqual([2, 4]);

      const rows = await db.select().from(habitTargetSchedules);
      expect(rows).toHaveLength(1);
      const days = await db
        .select()
        .from(habitTargetDays)
        .where(eq(habitTargetDays.scheduleId, created.id));
      expect(days.map((day) => day.dayOfWeek).sort()).toEqual([2, 4]);
    });

    it('treats an identical same-state retry as idempotent (no new version)', async () => {
      const created = await put(userId, 'walk', [1, 3], CREATE, MIDDAY_UTC);
      const retried = await put(
        userId,
        'walk',
        [3, 1],
        { expectedTargetId: created.id, expectedVersion: created.version },
        MIDDAY_UTC,
      );

      expect(retried).toMatchObject({ id: created.id, version: 1, weekdays: [1, 3] });
      expect(await db.select().from(habitTargetSchedules)).toHaveLength(1);
    });

    it('returns the existing target when an identical create is retried with a null token', async () => {
      const created = await put(userId, 'walk', [1], CREATE, MIDDAY_UTC);
      const retried = await put(userId, 'walk', [1], CREATE, MIDDAY_UTC);

      expect(retried.id).toBe(created.id);
      expect(retried.version).toBe(1);
      expect(await db.select().from(habitTargetSchedules)).toHaveLength(1);
    });

    it('rejects a stale integer version with CONFLICT and leaves server state intact', async () => {
      const created = await put(userId, 'walk', [1], CREATE, MIDDAY_UTC);

      await expect(
        put(
          userId,
          'walk',
          [2],
          { expectedTargetId: created.id, expectedVersion: 99 },
          MIDDAY_UTC,
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });

      const [row] = await db.select().from(habitTargetSchedules);
      expect(row).toMatchObject({ id: created.id, version: 1, effectiveFrom: MIDDAY_LOCAL_DATE });
      const days = await db.select().from(habitTargetDays);
      expect(days.map((day) => day.dayOfWeek)).toEqual([1]);
    });

    it('rejects a null-token create that conflicts with a different active state', async () => {
      await put(userId, 'walk', [1], CREATE, MIDDAY_UTC);

      await expect(put(userId, 'walk', [2], CREATE, MIDDAY_UTC)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      expect(await db.select().from(habitTargetSchedules)).toHaveLength(1);
    });
  });

  describe('historical versioning', () => {
    it('closes the previous version the day before and inserts a new version from today', async () => {
      const day1 = await put(userId, 'walk', [1], CREATE, MIDDAY_UTC);
      const day2 = await put(
        userId,
        'walk',
        [2],
        { expectedTargetId: day1.id, expectedVersion: day1.version },
        NEXT_DAY_UTC,
      );

      expect(day2.id).not.toBe(day1.id);
      expect(day2).toMatchObject({
        effectiveFrom: NEXT_DAY_LOCAL_DATE,
        effectiveTo: null,
        version: 1,
        weekdays: [2],
      });

      const versions = await loadHabitTargetVersionsInWindow(
        userId,
        '2026-09-01',
        '2026-09-30',
      );
      expect(versions).toEqual([
        {
          habitKey: 'walk',
          effectiveFrom: MIDDAY_LOCAL_DATE,
          effectiveTo: MIDDAY_LOCAL_DATE,
          version: 2,
          weekdays: [1],
        },
        {
          habitKey: 'walk',
          effectiveFrom: NEXT_DAY_LOCAL_DATE,
          effectiveTo: null,
          version: 1,
          weekdays: [2],
        },
      ]);
      expect(() => assertValidHabitTargetSchedules(versions)).not.toThrow();
    });

    it('never accepts the previous version token after a new version is created', async () => {
      const day1 = await put(userId, 'walk', [1], CREATE, MIDDAY_UTC);
      const day2 = await put(
        userId,
        'walk',
        [2],
        { expectedTargetId: day1.id, expectedVersion: day1.version },
        NEXT_DAY_UTC,
      );

      for (const stale of [
        { expectedTargetId: day1.id, expectedVersion: 1 },
        { expectedTargetId: day1.id, expectedVersion: 2 },
      ]) {
        await expect(put(userId, 'walk', [3], stale, NEXT_DAY_UTC)).rejects.toMatchObject({
          code: 'CONFLICT',
        });
      }

      const [active] = await db
        .select()
        .from(habitTargetSchedules)
        .where(eq(habitTargetSchedules.id, day2.id));
      expect(active).toMatchObject({ version: 1, effectiveFrom: NEXT_DAY_LOCAL_DATE });
    });

    it('bounds the window query to versions overlapping the requested interval', async () => {
      const day1 = await put(userId, 'walk', [1], CREATE, MIDDAY_UTC);
      await put(
        userId,
        'walk',
        [2],
        { expectedTargetId: day1.id, expectedVersion: day1.version },
        NEXT_DAY_UTC,
      );

      const past = await loadHabitTargetVersionsInWindow(userId, '2026-09-01', MIDDAY_LOCAL_DATE);
      expect(past.map((version) => version.effectiveFrom)).toEqual([MIDDAY_LOCAL_DATE]);

      const future = await loadHabitTargetVersionsInWindow(
        userId,
        NEXT_DAY_LOCAL_DATE,
        '2026-09-30',
      );
      expect(future.map((version) => version.effectiveFrom)).toEqual([NEXT_DAY_LOCAL_DATE]);

      const otherUser = await loadHabitTargetVersionsInWindow(
        otherUserId,
        '2026-09-01',
        '2026-09-30',
      );
      expect(otherUser).toEqual([]);
    });

    it('issues one bounded query for schedules and one for days', async () => {
      await put(userId, 'walk', [1, 3], CREATE, MIDDAY_UTC);
      await put(userId, 'sleep', [0], CREATE, MIDDAY_UTC);
      const executeSpy = jest.spyOn(db.$client, 'execute');

      const versions = await loadHabitTargetVersionsInWindow(userId, '2026-09-01', '2026-09-30');

      expect(versions).toHaveLength(2);
      expect(executeSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('deactivation', () => {
    it('cancels a version created today by deleting only that version and its days', async () => {
      await db.insert(habitLogs).values({
        userId,
        localDate: MIDDAY_LOCAL_DATE,
        habitKey: 'walk',
        done: true,
      });
      const created = await put(userId, 'walk', [1, 2], CREATE, MIDDAY_UTC);

      const result = await deactivateHabitTarget(
        userId,
        'walk',
        { targetId: created.id, version: created.version },
        MIDDAY_UTC,
      );

      expect(result).toEqual({ activeTarget: null });
      expect(await db.select().from(habitTargetSchedules)).toHaveLength(0);
      expect(await db.select().from(habitTargetDays)).toHaveLength(0);
      expect(await listCurrentHabitTargets(userId, MIDDAY_UTC)).toEqual([]);

      const logs = await db.select().from(habitLogs);
      expect(logs).toHaveLength(1);
    });

    it('closes an older version the day before without deleting history', async () => {
      const created = await put(userId, 'walk', [1], CREATE, MIDDAY_UTC);

      const result = await deactivateHabitTarget(
        userId,
        'walk',
        { targetId: created.id, version: created.version },
        NEXT_DAY_UTC,
      );

      expect(result).toEqual({ activeTarget: null });
      const [row] = await db
        .select()
        .from(habitTargetSchedules)
        .where(eq(habitTargetSchedules.id, created.id));
      expect(row).toMatchObject({
        effectiveFrom: MIDDAY_LOCAL_DATE,
        effectiveTo: MIDDAY_LOCAL_DATE,
        version: 2,
      });
      expect(await listCurrentHabitTargets(userId, NEXT_DAY_UTC)).toEqual([]);

      const versions = await loadHabitTargetVersionsInWindow(userId, '2026-09-01', '2026-09-30');
      expect(versions).toHaveLength(1);
      expect(versions[0]).toMatchObject({ effectiveTo: MIDDAY_LOCAL_DATE, weekdays: [1] });
    });

    it('is idempotent for a repeated DELETE after a same-day cancellation', async () => {
      const created = await put(userId, 'walk', [1], CREATE, MIDDAY_UTC);
      const token = { targetId: created.id, version: created.version };

      await deactivateHabitTarget(userId, 'walk', token, MIDDAY_UTC);
      const repeated = await deactivateHabitTarget(userId, 'walk', token, MIDDAY_UTC);

      expect(repeated).toEqual({ activeTarget: null });
    });

    it('is idempotent for a repeated DELETE after closing an older version', async () => {
      const created = await put(userId, 'walk', [1], CREATE, MIDDAY_UTC);
      const token = { targetId: created.id, version: created.version };

      await deactivateHabitTarget(userId, 'walk', token, NEXT_DAY_UTC);
      const repeated = await deactivateHabitTarget(userId, 'walk', token, NEXT_DAY_UTC);

      expect(repeated).toEqual({ activeTarget: null });
      expect(await db.select().from(habitTargetSchedules)).toHaveLength(1);
    });

    it('returns the idempotent absent state when the user never had a target', async () => {
      const result = await deactivateHabitTarget(
        userId,
        'walk',
        { targetId: 999_999, version: 1 },
        MIDDAY_UTC,
      );

      expect(result).toEqual({ activeTarget: null });
    });

    it('rejects a stale token while another active target exists with CONFLICT', async () => {
      const created = await put(userId, 'walk', [1], CREATE, MIDDAY_UTC);

      await expect(
        deactivateHabitTarget(userId, 'walk', { targetId: created.id, version: 99 }, MIDDAY_UTC),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('rejects an unknown catalog habit as NOT_FOUND', async () => {
      await expect(
        deactivateHabitTarget(
          userId,
          'meditation' as HabitKey,
          { targetId: 1, version: 1 },
          MIDDAY_UTC,
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects a malformed token as VALIDATION', async () => {
      await expect(
        deactivateHabitTarget(userId, 'walk', { targetId: 0, version: 1 }, MIDDAY_UTC),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });
  });

  describe('invariants at the storage boundary', () => {
    it('prevents a second active row for the same user and habit at the database level', async () => {
      const now = new Date();
      await db.insert(habitTargetSchedules).values({
        userId,
        habitKey: 'walk',
        effectiveFrom: '2026-09-01',
        effectiveTo: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });

      let thrown: unknown;
      try {
        await db.insert(habitTargetSchedules).values({
          userId,
          habitKey: 'walk',
          effectiveFrom: '2026-09-02',
          effectiveTo: null,
          version: 1,
          createdAt: now,
          updatedAt: now,
        });
      } catch (error) {
        thrown = error;
      }

      expect(isUniqueConstraintError(thrown)).toBe(true);
      expect(await db.select().from(habitTargetSchedules)).toHaveLength(1);
    });

    it('keeps days aligned to the active schedule after same-day edits', async () => {
      const created = await put(userId, 'walk', [1, 2, 3], CREATE, MIDDAY_UTC);
      await put(
        userId,
        'walk',
        [5],
        { expectedTargetId: created.id, expectedVersion: created.version },
        MIDDAY_UTC,
      );

      const days = await db
        .select()
        .from(habitTargetDays)
        .where(and(eq(habitTargetDays.scheduleId, created.id)));
      expect(days.map((day) => day.dayOfWeek)).toEqual([5]);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
