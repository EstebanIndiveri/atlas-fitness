import { describe, it, expect, beforeEach } from '@jest/globals';
import { db } from '@/lib/db/client';
import {
  botMessages,
  dailyCheckins,
  exercises,
  streakNudges,
  telegramLinkCodes,
  users,
  userStreaks,
  workouts,
  workoutSets,
} from '@/lib/db/schema';
import { getDaySummary } from './day-summary';
import * as workoutsService from './workouts';
import * as workoutSetsService from './workout-sets';
import { addLocalDateDays, cordobaLocalDate } from '@/lib/time/cordoba';

describe('getDaySummary', () => {
  let userId: number;
  let exerciseId: number;

  beforeEach(async () => {
    await db.delete(botMessages);
    await db.delete(streakNudges);
    await db.delete(dailyCheckins);
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(exercises);
    await db.delete(telegramLinkCodes);
    await db.delete(userStreaks);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({ name: 'Summary', email: 'summary@test.com', passwordHash: 'hash' })
      .returning();
    userId = user.id;

    const [exercise] = await db
      .insert(exercises)
      .values({
        slug: 'bench-press',
        name: 'Press Banca',
        muscleGroup: 'Pecho',
        instructions: 'x',
        isSystem: true,
      })
      .returning();
    exerciseId = exercise.id;
  });

  it('returns empty summary when there is no activity today', async () => {
    const today = cordobaLocalDate();
    const summary = await getDaySummary(userId, today);
    expect(summary.localDate).toBe(today);
    expect(summary.workouts).toEqual([]);
    expect(summary.setCount).toBe(0);
  });

  it('includes today Córdoba sets with weight as decimal string', async () => {
    const today = cordobaLocalDate();
    const workout = await workoutsService.createWorkout(userId);
    const set = await workoutSetsService.createWorkoutSet({
      workoutId: workout.id,
      userId,
      exerciseId,
      setIndex: 1,
      reps: 8,
      weightKg: '80.5',
    });
    expect(typeof set.weightKg).toBe('string');
    expect(set.weightKg).toBe('80.5');

    const summary = await getDaySummary(userId, today);
    expect(summary.setCount).toBe(1);
    expect(summary.hasOpenWorkout).toBe(true);
    expect(summary.workouts[0].sets[0]).toEqual({
      exerciseName: 'Press Banca',
      reps: 8,
      weightKg: '80.5',
    });
  });

  it('excludes workouts from another Córdoba day', async () => {
    const yesterday = addLocalDateDays(cordobaLocalDate(), -1);
    const [oldWorkout] = await db
      .insert(workouts)
      .values({
        userId,
        startedAt: new Date(`${yesterday}T15:00:00.000-03:00`),
        endedAt: new Date(`${yesterday}T16:00:00.000-03:00`),
      })
      .returning();
    await db.insert(workoutSets).values({
      workoutId: oldWorkout.id,
      exerciseId,
      setIndex: 1,
      reps: 5,
      weightKg: '60',
      completed: true,
    });

    const summary = await getDaySummary(userId, cordobaLocalDate());
    expect(summary.setCount).toBe(0);
  });
});
