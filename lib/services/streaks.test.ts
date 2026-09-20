import { describe, it, expect, beforeEach } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  sessions,
  dailyCheckins,
  streakNudges,
  telegramLinkCodes,
  userStreaks,
  users,
  workouts,
  workoutSets,
  botMessages,
} from '@/lib/db/schema';
import { addLocalDateDays, cordobaLocalDate } from '@/lib/time/cordoba';
import { STREAK_NUDGE_KIND, STREAK_NUDGE_RULE } from '@/types/streak';
import {
  computeStreakFromActiveDates,
  getStreakForUser,
  isActiveDay,
  isActiveDayFromFlags,
  runStreakNudges,
  updateStreakFromActivity,
} from './streaks';
import { recordDailyCheckIn } from './daily-checkin';
import * as workoutsService from './workouts';

function noonUtcForLocalDate(localDate: string): Date {
  return new Date(`${localDate}T15:00:00.000Z`);
}

/**
 * Active-day rule (Must):
 * Timezone: America/Argentina/Cordoba.
 * Date D is active for user U iff:
 * 1. A workout owned by U with ended_at not null whose Córdoba local date equals D, OR
 * 2. A daily_checkins row for U with local_date = D (mood already 1–5).
 * A day counts at most once. Missing a day resets current_streak to 0.
 * Streak freeze is out of Must (Should).
 */
describe('Active-day rule (pure)', () => {
  const TODAY = '2026-09-17';
  const YESTERDAY = '2026-09-16';
  const TWO_DAYS_AGO = '2026-09-15';

  describe('isActiveDayFromFlags', () => {
    it('is false when there is neither an ended workout nor a mood checkin', () => {
      expect(isActiveDayFromFlags(false, false)).toBe(false);
    });

    it('is true when there is an ended workout on D', () => {
      expect(isActiveDayFromFlags(true, false)).toBe(true);
    });

    it('is true when there is a mood checkin on D', () => {
      expect(isActiveDayFromFlags(false, true)).toBe(true);
    });

    it('does not double-count workout + mood on the same day', () => {
      expect(isActiveDayFromFlags(true, true)).toBe(true);
    });
  });

  describe('computeStreakFromActiveDates', () => {
    it('returns zeros when there is no activity', () => {
      expect(computeStreakFromActiveDates(TODAY, [], 0)).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
      });
    });

    it('counts today as a 1-day streak', () => {
      expect(computeStreakFromActiveDates(TODAY, [TODAY], 0)).toEqual({
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: TODAY,
      });
    });

    it('increments consecutive days ending today', () => {
      expect(
        computeStreakFromActiveDates(TODAY, [TWO_DAYS_AGO, YESTERDAY, TODAY], 0)
      ).toEqual({
        currentStreak: 3,
        longestStreak: 3,
        lastActiveDate: TODAY,
      });
    });

    it('does not double-count the same calendar date listed twice', () => {
      expect(computeStreakFromActiveDates(TODAY, [TODAY, TODAY], 0).currentStreak).toBe(
        1
      );
    });

    it('keeps the streak alive when yesterday is active but today is not yet', () => {
      expect(computeStreakFromActiveDates(TODAY, [YESTERDAY], 0)).toEqual({
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: YESTERDAY,
      });
    });

    it('resets current_streak to 0 after a lost day (no freeze)', () => {
      const result = computeStreakFromActiveDates(TODAY, [TWO_DAYS_AGO], 0);
      expect(result.currentStreak).toBe(0);
      expect(result.lastActiveDate).toBe(TWO_DAYS_AGO);
      expect(result.longestStreak).toBe(1);
    });

    it('stops counting at the first gap walking back from today', () => {
      expect(
        computeStreakFromActiveDates(TODAY, [TWO_DAYS_AGO, TODAY], 0).currentStreak
      ).toBe(1);
    });

    it('preserves a previous longest longer than the current streak', () => {
      expect(
        computeStreakFromActiveDates(TODAY, [TODAY], 5).longestStreak
      ).toBe(5);
    });
  });
});

describe('Streaks service', () => {
  let testUserId: number;
  const NOW = new Date('2026-09-17T15:00:00.000Z');
  const TODAY = cordobaLocalDate(NOW);

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
        name: 'Streak User',
        email: `streak-${Date.now()}@test.com`,
        passwordHash: 'hash',
      })
      .returning();
    testUserId = user.id;
  });

  describe('isActiveDay', () => {
    it('is false with no activity', async () => {
      await expect(isActiveDay(testUserId, TODAY)).resolves.toBe(false);
    });

    it('is true when a workout ended on that Córdoba date', async () => {
      const workout = await workoutsService.createWorkout(testUserId);
      await workoutsService.updateWorkout(workout.id, testUserId, { endedAt: NOW });

      await expect(isActiveDay(testUserId, TODAY)).resolves.toBe(true);
    });

    it('is true when a mood checkin exists for that local date', async () => {
      await recordDailyCheckIn({ userId: testUserId, mood: 4, now: noonUtcForLocalDate(TODAY) });
      await expect(isActiveDay(testUserId, TODAY)).resolves.toBe(true);
    });

    it('ignores unended and soft-deleted workouts', async () => {
      const open = await workoutsService.createWorkout(testUserId);
      expect(open.endedAt).toBeNull();
      await expect(isActiveDay(testUserId, TODAY)).resolves.toBe(false);

      await workoutsService.deleteWorkout(open.id, testUserId);

      const ended = await workoutsService.createWorkout(testUserId);
      await db
        .update(workouts)
        .set({ endedAt: NOW, deletedAt: NOW })
        .where(eq(workouts.id, ended.id));

      await expect(isActiveDay(testUserId, TODAY)).resolves.toBe(false);
    });
  });

  describe('updateStreakFromActivity / getStreakForUser', () => {
    it('returns zeros for a user with no activity', async () => {
      const streak = await getStreakForUser(testUserId, NOW);
      expect(streak).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
      });
    });

    it('sets current_streak to 1 after ending a workout today', async () => {
      const workout = await workoutsService.createWorkout(testUserId);
      await workoutsService.updateWorkout(workout.id, testUserId, { endedAt: NOW });

      const streak = await getStreakForUser(testUserId, NOW);
      expect(streak.currentStreak).toBe(1);
      expect(streak.longestStreak).toBe(1);
      expect(streak.lastActiveDate).toBe(TODAY);
    });

    it('does not double-count mood + workout on the same Córdoba day', async () => {
      const workout = await workoutsService.createWorkout(testUserId);
      await workoutsService.updateWorkout(workout.id, testUserId, { endedAt: NOW });
      await recordDailyCheckIn({ userId: testUserId, mood: 5, now: noonUtcForLocalDate(TODAY) });

      const streak = await getStreakForUser(testUserId, NOW);
      expect(streak.currentStreak).toBe(1);
      expect(streak.lastActiveDate).toBe(TODAY);
    });

    it('increments when yesterday was also active', async () => {
      const yesterday = addLocalDateDays(TODAY, -1);
      await recordDailyCheckIn({ userId: testUserId, mood: 3, now: noonUtcForLocalDate(yesterday) });
      const workout = await workoutsService.createWorkout(testUserId);
      await workoutsService.updateWorkout(workout.id, testUserId, { endedAt: NOW });

      const streak = await getStreakForUser(testUserId, NOW);
      expect(streak.currentStreak).toBe(2);
      expect(streak.longestStreak).toBe(2);
    });

    it('resets current_streak after a lost day (TZ Córdoba)', async () => {
      const twoDaysAgo = addLocalDateDays(TODAY, -2);
      await recordDailyCheckIn({ userId: testUserId, mood: 4, now: noonUtcForLocalDate(twoDaysAgo) });

      const streak = await updateStreakFromActivity(testUserId, NOW);
      expect(streak.currentStreak).toBe(0);
      expect(streak.lastActiveDate).toBe(twoDaysAgo);
      expect(streak.longestStreak).toBe(1);
    });

    it('upserts a single user_streaks row', async () => {
      await updateStreakFromActivity(testUserId, NOW);
      await updateStreakFromActivity(testUserId, NOW);
      const rows = await db.select().from(userStreaks);
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(testUserId);
    });

    it('treats last_workout_date as last active day for mood-only activity', async () => {
      await recordDailyCheckIn({ userId: testUserId, mood: 2, now: noonUtcForLocalDate(TODAY) });
      const streak = await getStreakForUser(testUserId, NOW);
      expect(streak.lastActiveDate).toBe(TODAY);
      expect(streak.currentStreak).toBe(1);
    });
  });

  describe('runStreakNudges', () => {
    it('records a nudge for users active yesterday but not today', async () => {
      const yesterday = addLocalDateDays(TODAY, -1);
      await recordDailyCheckIn({ userId: testUserId, mood: 4, now: noonUtcForLocalDate(yesterday) });
      await updateStreakFromActivity(testUserId, NOW);

      const result = await runStreakNudges(NOW);
      expect(result.date).toBe(TODAY);
      expect(result.rule).toBe(STREAK_NUDGE_RULE);
      expect(result.considered).toBe(1);
      expect(result.recorded).toBe(1);
      expect(result.skipped).toBe(0);

      const rows = await db.select().from(streakNudges);
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(testUserId);
      expect(rows[0].localDate).toBe(TODAY);
      expect(rows[0].kind).toBe(STREAK_NUDGE_KIND);
    });

    it('is idempotent — a second run the same Córdoba day does not duplicate', async () => {
      const yesterday = addLocalDateDays(TODAY, -1);
      await recordDailyCheckIn({ userId: testUserId, mood: 4, now: noonUtcForLocalDate(yesterday) });

      const first = await runStreakNudges(NOW);
      const second = await runStreakNudges(NOW);

      expect(first.recorded).toBe(1);
      expect(second.recorded).toBe(0);
      expect(second.skipped).toBe(1);
      expect(second.considered).toBe(1);

      const rows = await db.select().from(streakNudges);
      expect(rows).toHaveLength(1);
    });

    it('does not nudge users who are already active today', async () => {
      await recordDailyCheckIn({ userId: testUserId, mood: 5, now: noonUtcForLocalDate(TODAY) });
      const result = await runStreakNudges(NOW);
      expect(result.considered).toBe(0);
      expect(result.recorded).toBe(0);
      const rows = await db.select().from(streakNudges);
      expect(rows).toHaveLength(0);
    });
  });
});
