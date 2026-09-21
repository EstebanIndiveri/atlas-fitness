import { beforeEach, describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  botMessages,
  coachRecommendations,
  dailyCheckins,
  exercises,
  habitLogs,
  postWorkoutFeedback,
  routineExercises,
  routines,
  sessions,
  streakNudges,
  telegramLinkCodes,
  userStreaks,
  users,
  workoutQueueMutations,
  workouts,
  workoutSets,
} from '@/lib/db/schema';

import { getStrengthProgressSummary } from './strength-progress';

const NOW = new Date('2026-09-24T15:00:00.000Z');

describe('getStrengthProgressSummary', () => {
  let userId: number;
  let benchId: number;
  let pressId: number;

  beforeEach(async () => {
    await db.delete(habitLogs);
    await db.delete(streakNudges);
    await db.delete(dailyCheckins);
    await db.delete(coachRecommendations);
    await db.delete(postWorkoutFeedback);
    await db.delete(workoutQueueMutations);
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(routineExercises);
    await db.delete(routines);
    await db.delete(exercises);
    await db.delete(botMessages);
    await db.delete(telegramLinkCodes);
    await db.delete(userStreaks);
    await db.delete(sessions);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({ name: 'Strength User', email: 'strength-progress@test.com', passwordHash: 'hash' })
      .returning();
    userId = user.id;

    const inserted = await db
      .insert(exercises)
      .values([
        {
          slug: 'strength-bench',
          name: 'Press Banca',
          muscleGroup: 'Pecho',
          instructions: 'Empujar la barra con control.',
          isSystem: true,
        },
        {
          slug: 'strength-press',
          name: 'Press Militar',
          muscleGroup: 'Hombros',
          instructions: 'Empujar verticalmente con control.',
          isSystem: true,
        },
      ])
      .returning();
    benchId = inserted[0].id;
    pressId = inserted[1].id;
  });

  async function addWorkout(startedAt: string, endedAt: string | null, owner = userId): Promise<number> {
    const [workout] = await db
      .insert(workouts)
      .values({
        userId: owner,
        startedAt: new Date(startedAt),
        endedAt: endedAt ? new Date(endedAt) : null,
      })
      .returning();
    return workout.id;
  }

  async function addSet(input: {
    workoutId: number;
    exerciseId: number;
    setIndex: number;
    reps: number;
    weightKg: string;
    completed?: boolean;
    deletedAt?: string;
  }): Promise<void> {
    await db.insert(workoutSets).values({
      workoutId: input.workoutId,
      exerciseId: input.exerciseId,
      setIndex: input.setIndex,
      reps: input.reps,
      weightKg: input.weightKg,
      completed: input.completed ?? true,
      deletedAt: input.deletedAt ? new Date(input.deletedAt) : null,
    });
  }

  it('computes increasing session-volume points from completed persisted sets', async () => {
    const olderWorkoutId = await addWorkout('2026-09-22T12:00:00.000Z', '2026-09-22T13:00:00.000Z');
    await addSet({ workoutId: olderWorkoutId, exerciseId: benchId, setIndex: 1, reps: 8, weightKg: '15' });
    await addSet({ workoutId: olderWorkoutId, exerciseId: pressId, setIndex: 2, reps: 10, weightKg: '15' });

    const newerWorkoutId = await addWorkout('2026-09-24T12:00:00.000Z', '2026-09-24T13:00:00.000Z');
    await addSet({ workoutId: newerWorkoutId, exerciseId: benchId, setIndex: 1, reps: 8, weightKg: '20' });
    await addSet({ workoutId: newerWorkoutId, exerciseId: pressId, setIndex: 2, reps: 10, weightKg: '20' });

    const summary = await getStrengthProgressSummary(userId, 'week', NOW);

    expect(summary.points).toEqual([
      {
        workoutId: olderWorkoutId,
        startedAt: '2026-09-22T12:00:00.000Z',
        localDate: '2026-09-22',
        totalVolumeKg: '270',
        completedSets: 2,
      },
      {
        workoutId: newerWorkoutId,
        startedAt: '2026-09-24T12:00:00.000Z',
        localDate: '2026-09-24',
        totalVolumeKg: '360',
        completedSets: 2,
      },
    ]);
    expect(summary.hasLoggedSets).toBe(true);
    expect(summary.latestVolumeKg).toBe('360');
  });

  it('returns a single starting-point marker when exactly one session has logged sets', async () => {
    const workoutId = await addWorkout('2026-09-24T12:00:00.000Z', '2026-09-24T13:00:00.000Z');
    await addSet({ workoutId, exerciseId: benchId, setIndex: 1, reps: 8, weightKg: '15' });

    const summary = await getStrengthProgressSummary(userId, 'week', NOW);

    expect(summary.points).toHaveLength(1);
    expect(summary.points[0].totalVolumeKg).toBe('120');
    expect(summary.trendLabel).toBe('Punto de partida');
  });

  it('includes a completed workout that started before the period but ended inside it', async () => {
    const workoutId = await addWorkout('2026-08-25T23:45:00.000Z', '2026-08-26T03:15:00.000Z');
    await addSet({ workoutId, exerciseId: benchId, setIndex: 1, reps: 8, weightKg: '15' });

    const summary = await getStrengthProgressSummary(userId, 'month', NOW);

    expect(summary.points).toEqual([
      {
        workoutId,
        startedAt: '2026-08-25T23:45:00.000Z',
        localDate: '2026-08-26',
        totalVolumeKg: '120',
        completedSets: 1,
      },
    ]);
    expect(summary.hasLoggedSets).toBe(true);
  });

  it('returns an honest empty strength summary when the user has zero completed logged sets', async () => {
    const openWorkoutId = await addWorkout('2026-09-24T12:00:00.000Z', null);
    await addSet({ workoutId: openWorkoutId, exerciseId: benchId, setIndex: 1, reps: 8, weightKg: '15' });
    const completedWorkoutId = await addWorkout('2026-09-23T12:00:00.000Z', '2026-09-23T13:00:00.000Z');
    await addSet({
      workoutId: completedWorkoutId,
      exerciseId: benchId,
      setIndex: 1,
      reps: 8,
      weightKg: '15',
      completed: false,
    });

    const summary = await getStrengthProgressSummary(userId, 'week', NOW);

    expect(summary).toMatchObject({
      hasLoggedSets: false,
      points: [],
      latestVolumeKg: null,
      trendLabel: 'Sin datos de fuerza',
    });
  });

  it('keeps historical volume when a logged exercise is later soft-deleted', async () => {
    const workoutId = await addWorkout('2026-09-24T12:00:00.000Z', '2026-09-24T13:00:00.000Z');
    await addSet({ workoutId, exerciseId: benchId, setIndex: 1, reps: 8, weightKg: '15' });
    await db
      .update(exercises)
      .set({ deletedAt: new Date('2026-09-25T12:00:00.000Z') })
      .where(eq(exercises.id, benchId));

    const summary = await getStrengthProgressSummary(userId, 'week', NOW);

    expect(summary.hasLoggedSets).toBe(true);
    expect(summary.latestVolumeKg).toBe('120');
    expect(summary.points).toHaveLength(1);
  });
});
