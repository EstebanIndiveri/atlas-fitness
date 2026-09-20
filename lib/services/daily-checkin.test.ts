import { describe, it, expect, beforeEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  botMessages,
  dailyCheckins,
  sessions,
  streakNudges,
  telegramLinkCodes,
  userStreaks,
  users,
  workouts,
  workoutSets,
} from '@/lib/db/schema';
import {
  DAILY_CHECK_IN_NOTE_MAX_LENGTH,
  getDailyCheckIn,
  getTodayCheckIn,
  recordDailyCheckIn,
} from '@/lib/services/daily-checkin';
import { getStreakForUser } from '@/lib/services/streaks';
import { AppError } from '@/types/errors';

const CHECK_IN_NOW = new Date('2026-09-17T15:00:00.000Z');
const CHECK_IN_LOCAL_DATE = '2026-09-17';

describe('DailyCheckIn service', () => {
  let userId: number;

  beforeEach(async () => {
    await db.delete(streakNudges);
    await db.delete(dailyCheckins);
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(botMessages);
    await db.delete(telegramLinkCodes);
    await db.delete(userStreaks);
    await db.delete(sessions);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({
        name: 'Daily Check-In User',
        email: `daily-checkin-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();

    userId = user.id;
  });

  it('records a mood-only check-in with null energy and note, then updates streaks', async () => {
    const recorded = await recordDailyCheckIn({
      userId,
      mood: 4,
      now: CHECK_IN_NOW,
    });

    const streak = await getStreakForUser(userId, CHECK_IN_NOW);

    expect(recorded).toMatchObject({
      userId,
      localDate: CHECK_IN_LOCAL_DATE,
      mood: 4,
      energy: null,
      note: null,
    });
    expect(streak).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: CHECK_IN_LOCAL_DATE,
    });
  });

  it('records full mood, energy, and note values for today in Córdoba', async () => {
    const recorded = await recordDailyCheckIn({
      userId,
      mood: 5,
      energy: 'high',
      note: 'Dormí bien.',
      now: CHECK_IN_NOW,
    });

    const today = await getTodayCheckIn(userId, CHECK_IN_NOW);

    expect(recorded).toMatchObject({
      userId,
      localDate: CHECK_IN_LOCAL_DATE,
      mood: 5,
      energy: 'high',
      note: 'Dormí bien.',
    });
    expect(today?.id).toBe(recorded.id);
    expect(today?.energy).toBe('high');
    expect(today?.note).toBe('Dormí bien.');
  });

  it('updates the same local day instead of inserting duplicate rows', async () => {
    const first = await recordDailyCheckIn({
      userId,
      mood: 2,
      energy: 'low',
      note: 'Cansado.',
      now: CHECK_IN_NOW,
    });

    const second = await recordDailyCheckIn({
      userId,
      mood: 5,
      now: CHECK_IN_NOW,
    });

    const rows = await db
      .select()
      .from(dailyCheckins)
      .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.localDate, CHECK_IN_LOCAL_DATE)));

    expect(second.id).toBe(first.id);
    expect(second.createdAt).toEqual(first.createdAt);
    expect(second.mood).toBe(5);
    expect(second.energy).toBeNull();
    expect(second.note).toBeNull();
    expect(rows).toHaveLength(1);
  });

  it('keeps one row when recording the same mood repeatedly for one day', async () => {
    const first = await recordDailyCheckIn({ userId, mood: 4, now: CHECK_IN_NOW });
    const second = await recordDailyCheckIn({ userId, mood: 4, now: CHECK_IN_NOW });
    const third = await recordDailyCheckIn({ userId, mood: 4, now: CHECK_IN_NOW });

    const rows = await db.select().from(dailyCheckins);

    expect(second.id).toBe(first.id);
    expect(third.id).toBe(first.id);
    expect(rows).toHaveLength(1);
  });

  it('allows different users to check in on the same local date', async () => {
    const [secondUser] = await db
      .insert(users)
      .values({
        name: 'Second User',
        email: `daily-checkin-second-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();

    const first = await recordDailyCheckIn({ userId, mood: 3, now: CHECK_IN_NOW });
    const second = await recordDailyCheckIn({ userId: secondUser.id, mood: 5, now: CHECK_IN_NOW });

    const rows = await db.select().from(dailyCheckins);

    expect(first.userId).toBe(userId);
    expect(second.userId).toBe(secondUser.id);
    expect(rows).toHaveLength(2);
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
    const utcDate = await getTodayCheckIn(userId, CHECK_IN_NOW);

    expect(today?.localDate).toBe('2026-09-16');
    expect(utcDate).toBeNull();
  });

  it('returns a check-in by explicit local date without leaking another user row', async () => {
    const [secondUser] = await db
      .insert(users)
      .values({
        name: 'Second User',
        email: `daily-checkin-reader-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();

    await recordDailyCheckIn({ userId, mood: 4, now: CHECK_IN_NOW });

    await expect(getDailyCheckIn(secondUser.id, CHECK_IN_LOCAL_DATE)).resolves.toBeNull();
    await expect(getDailyCheckIn(userId, CHECK_IN_LOCAL_DATE)).resolves.toMatchObject({
      userId,
      localDate: CHECK_IN_LOCAL_DATE,
      mood: 4,
      energy: null,
      note: null,
    });
  });

  it('returns legacy mood-only rows without fabricating energy', async () => {
    await db.insert(dailyCheckins).values({
      userId,
      localDate: CHECK_IN_LOCAL_DATE,
      mood: 3,
    });

    const today = await getTodayCheckIn(userId, CHECK_IN_NOW);

    expect(today).toMatchObject({
      userId,
      localDate: CHECK_IN_LOCAL_DATE,
      mood: 3,
      energy: null,
      note: null,
    });
  });

  it('rejects invalid mood with a typed validation error', async () => {
    await expect(recordDailyCheckIn({ userId, mood: 0, now: CHECK_IN_NOW })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(recordDailyCheckIn({ userId, mood: 6, now: CHECK_IN_NOW })).rejects.toThrow(AppError);
  });

  it('rejects notes over the 500 character limit with a typed validation error', async () => {
    await expect(
      recordDailyCheckIn({
        userId,
        mood: 4,
        note: 'x'.repeat(DAILY_CHECK_IN_NOTE_MAX_LENGTH + 1),
        now: CHECK_IN_NOW,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects invalid energy values with a typed validation error', async () => {
    await expect(
      recordDailyCheckIn({
        userId,
        mood: 4,
        energy: 'exhausted',
        now: CHECK_IN_NOW,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
