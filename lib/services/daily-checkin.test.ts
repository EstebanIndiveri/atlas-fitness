import { describe, it, expect, beforeEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { dailyCheckins, users } from '@/lib/db/schema';
import { recordDailyCheckIn, getTodayCheckIn } from '@/lib/services/daily-checkin';

describe('DailyCheckIn adaptive service', () => {
  let userId: number;

  beforeEach(async () => {
    await db.delete(dailyCheckins);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({
        name: 'Adaptive User',
        email: `adaptive-checkin-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();

    userId = user.id;
  });

  it('records an explicit mood and energy, then returns today in Córdoba', async () => {
    const now = new Date('2026-09-17T15:00:00.000Z');

    const recorded = await recordDailyCheckIn({
      userId,
      mood: 4,
      energy: 'high',
      note: 'Dormí bien.',
      now,
    });

    const today = await getTodayCheckIn(userId, now);

    expect(recorded).toMatchObject({
      userId,
      localDate: '2026-09-17',
      mood: 4,
      energy: 'high',
      note: 'Dormí bien.',
    });
    expect(today?.id).toBe(recorded.id);
    expect(today?.energy).toBe('high');
  });

  it('updates the same local day instead of inserting a duplicate row', async () => {
    const now = new Date('2026-09-17T15:00:00.000Z');
    const first = await recordDailyCheckIn({
      userId,
      mood: 2,
      energy: 'low',
      note: 'Cansado.',
      now,
    });

    const second = await recordDailyCheckIn({
      userId,
      mood: 5,
      energy: 'medium',
      note: null,
      now,
    });

    const rows = await db
      .select()
      .from(dailyCheckins)
      .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.localDate, '2026-09-17')));

    expect(second.id).toBe(first.id);
    expect(second.mood).toBe(5);
    expect(second.energy).toBe('medium');
    expect(second.note).toBeNull();
    expect(rows).toHaveLength(1);
  });

  it('resolves today using Córdoba local date across the UTC midnight boundary', async () => {
    const utcNextDayStillCordobaPrevious = new Date('2026-09-17T02:30:00.000Z');

    await recordDailyCheckIn({
      userId,
      mood: 3,
      energy: 'medium',
      now: utcNextDayStillCordobaPrevious,
    });

    const today = await getTodayCheckIn(userId, utcNextDayStillCordobaPrevious);
    const utcDate = await getTodayCheckIn(userId, new Date('2026-09-17T15:00:00.000Z'));

    expect(today?.localDate).toBe('2026-09-16');
    expect(utcDate).toBeNull();
  });

  it('returns legacy mood-only rows without fabricating energy', async () => {
    const now = new Date('2026-09-17T15:00:00.000Z');

    await db.insert(dailyCheckins).values({
      userId,
      localDate: '2026-09-17',
      mood: 3,
    });

    const today = await getTodayCheckIn(userId, now);

    expect(today).toMatchObject({
      userId,
      localDate: '2026-09-17',
      mood: 3,
      energy: null,
      note: null,
    });
  });

  it('rejects invalid mood and energy with typed validation errors', async () => {
    await expect(
      recordDailyCheckIn({
        userId,
        mood: 0,
        energy: 'low',
        now: new Date('2026-09-17T15:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    await expect(
      recordDailyCheckIn({
        userId,
        mood: 4,
        energy: 'exhausted',
        now: new Date('2026-09-17T15:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
