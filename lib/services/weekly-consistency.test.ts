import { describe, it, expect, beforeEach } from '@jest/globals';
import { db } from '@/lib/db/client';
import {
  dailyCheckins,
  sessions,
  streakNudges,
  telegramLinkCodes,
  userStreaks,
  users,
  workouts,
  workoutSets,
  botMessages,
} from '@/lib/db/schema';
import { cordobaLocalDate } from '@/lib/time/cordoba';
import { recordDailyCheckIn } from './daily-checkin';
import * as workoutsService from './workouts';
import {
  computeWeekConsistency,
  getWeekConsistencyForUser,
} from './weekly-consistency';

function noonUtcForLocalDate(localDate: string): Date {
  return new Date(`${localDate}T15:00:00.000Z`);
}

describe('computeWeekConsistency (pure)', () => {
  // 2026-09-24 is a Thursday (Monday-first index 3). Week is 2026-09-21 .. 2026-09-27.
  const TODAY = '2026-09-24';

  it('builds a Monday→Sunday week with correct bounds and 7 ordered days', () => {
    const week = computeWeekConsistency(TODAY, new Set());
    expect(week.weekStart).toBe('2026-09-21');
    expect(week.weekEnd).toBe('2026-09-27');
    expect(week.days).toHaveLength(7);
    expect(week.days.map((d) => d.date)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
    expect(week.days.map((d) => d.weekdayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('flags today, past and future days honestly', () => {
    const week = computeWeekConsistency(TODAY, new Set());
    const today = week.days.find((d) => d.date === TODAY);
    expect(today?.isToday).toBe(true);
    expect(today?.isFuture).toBe(false);
    expect(week.days.find((d) => d.date === '2026-09-23')?.isFuture).toBe(false);
    expect(week.days.find((d) => d.date === '2026-09-25')?.isFuture).toBe(true);
    expect(week.days.filter((d) => d.isToday)).toHaveLength(1);
  });

  it('marks only active dates within the week and counts them', () => {
    const active = new Set(['2026-09-21', '2026-09-24', '2026-09-30']);
    const week = computeWeekConsistency(TODAY, active);
    expect(week.days.find((d) => d.date === '2026-09-21')?.active).toBe(true);
    expect(week.days.find((d) => d.date === '2026-09-24')?.active).toBe(true);
    expect(week.days.find((d) => d.date === '2026-09-22')?.active).toBe(false);
    expect(week.activeCount).toBe(2);
  });

  it('never marks a future day active even if a stray date leaks in', () => {
    const week = computeWeekConsistency(TODAY, new Set(['2026-09-26']));
    expect(week.days.find((d) => d.date === '2026-09-26')?.active).toBe(false);
    expect(week.activeCount).toBe(0);
  });

  it('handles a Sunday today (index 6) as the last day of the week', () => {
    const week = computeWeekConsistency('2026-09-27', new Set());
    expect(week.weekStart).toBe('2026-09-21');
    expect(week.weekEnd).toBe('2026-09-27');
    expect(week.days[6].isToday).toBe(true);
    expect(week.days.every((d) => !d.isFuture)).toBe(true);
  });

  it('handles a Monday today (index 0) as the first day of the week', () => {
    const week = computeWeekConsistency('2026-09-21', new Set());
    expect(week.days[0].isToday).toBe(true);
    expect(week.days[0].isFuture).toBe(false);
    expect(week.days.slice(1).every((d) => d.isFuture)).toBe(true);
    expect(week.activeCount).toBe(0);
  });

  it('rejects an invalid date string', () => {
    expect(() => computeWeekConsistency('not-a-date', new Set())).toThrow();
  });
});

describe('getWeekConsistencyForUser (integration)', () => {
  let testUserId: number;
  const NOW = new Date('2026-09-24T15:00:00.000Z');
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
        name: 'Week User',
        email: `week-${Date.now()}@test.com`,
        passwordHash: 'hash',
      })
      .returning();
    testUserId = user.id;
  });

  it('returns an all-inactive week for a user with no activity', async () => {
    const week = await getWeekConsistencyForUser(testUserId, NOW);
    expect(week.activeCount).toBe(0);
    expect(week.days.every((d) => !d.active)).toBe(true);
  });

  it('marks today active after ending a workout today', async () => {
    const workout = await workoutsService.createWorkout(testUserId);
    await workoutsService.updateWorkout(workout.id, testUserId, { endedAt: NOW });

    const week = await getWeekConsistencyForUser(testUserId, NOW);
    expect(week.days.find((d) => d.date === TODAY)?.active).toBe(true);
    expect(week.activeCount).toBe(1);
  });

  it('marks a day active from a daily check-in and does not double-count', async () => {
    const workout = await workoutsService.createWorkout(testUserId);
    await workoutsService.updateWorkout(workout.id, testUserId, { endedAt: NOW });
    await recordDailyCheckIn({ userId: testUserId, mood: 4, now: noonUtcForLocalDate(TODAY) });

    const week = await getWeekConsistencyForUser(testUserId, NOW);
    expect(week.activeCount).toBe(1);
  });

  it('ignores activity outside the current week', async () => {
    await recordDailyCheckIn({
      userId: testUserId,
      mood: 3,
      now: noonUtcForLocalDate('2026-09-14'),
    });

    const week = await getWeekConsistencyForUser(testUserId, NOW);
    expect(week.activeCount).toBe(0);
  });
});
