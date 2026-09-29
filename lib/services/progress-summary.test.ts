import { beforeEach, describe, expect, it } from '@jest/globals';

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

import { getProgressSummary } from './progress-summary';

const NOW = new Date('2026-09-24T15:00:00.000Z');

describe('getProgressSummary', () => {
  let userId: number;
  let routineId: number;
  let exerciseId: number;

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
      .values({ name: 'Progress User', email: 'progress-summary@test.com', passwordHash: 'hash' })
      .returning();
    userId = user.id;

    const [routine] = await db
      .insert(routines)
      .values({ slug: 'progress-routine', name: 'Torso fuerte', isSystem: true })
      .returning();
    routineId = routine.id;

    const [exercise] = await db
      .insert(exercises)
      .values({
        slug: 'progress-exercise',
        name: 'Press Banca',
        muscleGroup: 'Pecho',
        instructions: 'Empujar la barra con control.',
        isSystem: true,
      })
      .returning();
    exerciseId = exercise.id;
  });

  async function addWorkout(input: {
    startedAt: string;
    endedAt: string | null;
    deletedAt?: string;
    routineId?: number | null;
    userId?: number;
  }): Promise<number> {
    const [workout] = await db
      .insert(workouts)
      .values({
        userId: input.userId ?? userId,
        routineId: input.routineId === undefined ? routineId : input.routineId,
        startedAt: new Date(input.startedAt),
        endedAt: input.endedAt ? new Date(input.endedAt) : null,
        deletedAt: input.deletedAt ? new Date(input.deletedAt) : null,
      })
      .returning();
    return workout.id;
  }

  async function addSet(input: {
    workoutId: number;
    setIndex: number;
    reps: number;
    weightKg: string;
    completed?: boolean;
    deletedAt?: string;
  }): Promise<void> {
    await db.insert(workoutSets).values({
      workoutId: input.workoutId,
      exerciseId,
      setIndex: input.setIndex,
      reps: input.reps,
      weightKg: input.weightKg,
      completed: input.completed ?? true,
      deletedAt: input.deletedAt ? new Date(input.deletedAt) : null,
    });
  }

  it('returns zeros and an empty list when the selected window has no completed sessions', async () => {
    const summary = await getProgressSummary(userId, 'week', NOW);

    expect(summary).toEqual({
      period: 'week',
      fromLocalDate: '2026-09-21',
      toLocalDate: '2026-09-27',
      completedSessions: 0,
      totalDurationMinutes: 0,
      strength: {
        hasLoggedSets: false,
        latestVolumeKg: null,
        points: [],
        trendLabel: 'Sin datos de fuerza',
      },
      sessions: [],
    });
  });

  it('counts only ended, non-deleted workouts inside the Córdoba window', async () => {
    const completedId = await addWorkout({
      startedAt: '2026-09-24T13:00:00.000Z',
      endedAt: '2026-09-24T14:00:00.000Z',
    });
    await addWorkout({
      startedAt: '2026-09-24T15:00:00.000Z',
      endedAt: null,
    });
    await addWorkout({
      startedAt: '2026-09-24T16:00:00.000Z',
      endedAt: '2026-09-24T17:00:00.000Z',
      deletedAt: '2026-09-24T17:30:00.000Z',
    });
    await addWorkout({
      startedAt: '2026-09-28T13:00:00.000Z',
      endedAt: '2026-09-28T14:00:00.000Z',
    });

    const summary = await getProgressSummary(userId, 'week', NOW);

    expect(summary.completedSessions).toBe(1);
    expect(summary.sessions.map((session) => session.workoutId)).toEqual([completedId]);
  });

  it('excludes sessions from other users', async () => {
    const [otherUser] = await db
      .insert(users)
      .values({ name: 'Other User', email: 'other-progress@test.com', passwordHash: 'hash' })
      .returning();
    await addWorkout({
      userId: otherUser.id,
      startedAt: '2026-09-24T13:00:00.000Z',
      endedAt: '2026-09-24T14:00:00.000Z',
    });

    const summary = await getProgressSummary(userId, 'week', NOW);

    expect(summary.completedSessions).toBe(0);
    expect(summary.sessions).toEqual([]);
  });

  it('computes inclusive month and quarter local-date windows', async () => {
    const month = await getProgressSummary(userId, 'month', NOW);
    const quarter = await getProgressSummary(userId, 'quarter', NOW);

    expect(month.fromLocalDate).toBe('2026-08-26');
    expect(month.toLocalDate).toBe('2026-09-24');
    expect(quarter.fromLocalDate).toBe('2026-06-27');
    expect(quarter.toLocalDate).toBe('2026-09-24');
  });

  it('rounds durations, sums total minutes and orders recent sessions descending', async () => {
    const olderId = await addWorkout({
      startedAt: '2026-09-22T12:00:00.000Z',
      endedAt: '2026-09-22T12:44:31.000Z',
    });
    const newerId = await addWorkout({
      startedAt: '2026-09-24T12:00:00.000Z',
      endedAt: '2026-09-24T12:30:29.000Z',
    });

    const summary = await getProgressSummary(userId, 'week', NOW);

    expect(summary.totalDurationMinutes).toBe(75);
    expect(summary.sessions.map((session) => session.workoutId)).toEqual([newerId, olderId]);
    expect(summary.sessions.map((session) => session.durationMinutes)).toEqual([30, 45]);
  });

  it('returns the joined routine name and null when a session has no routine', async () => {
    await addWorkout({
      startedAt: '2026-09-24T12:00:00.000Z',
      endedAt: '2026-09-24T13:00:00.000Z',
    });
    await addWorkout({
      routineId: null,
      startedAt: '2026-09-23T12:00:00.000Z',
      endedAt: '2026-09-23T13:00:00.000Z',
    });

    const summary = await getProgressSummary(userId, 'week', NOW);

    expect(summary.sessions.map((session) => session.routineName)).toEqual([
      'Torso fuerte',
      null,
    ]);
  });

  it('carries exact decimal session volume from eligible sets and null only when none qualify', async () => {
    const withVolume = await addWorkout({
      startedAt: '2026-09-24T12:00:00.000Z',
      endedAt: '2026-09-24T13:00:00.000Z',
    });
    await addSet({ workoutId: withVolume, setIndex: 1, reps: 8, weightKg: '12.5' });
    await addSet({ workoutId: withVolume, setIndex: 2, reps: 4, weightKg: '2.25' });

    const noSets = await addWorkout({
      startedAt: '2026-09-23T12:00:00.000Z',
      endedAt: '2026-09-23T13:00:00.000Z',
    });

    const ineligible = await addWorkout({
      startedAt: '2026-09-22T12:00:00.000Z',
      endedAt: '2026-09-22T13:00:00.000Z',
    });
    await addSet({
      workoutId: ineligible,
      setIndex: 1,
      reps: 10,
      weightKg: '50',
      completed: false,
    });
    await addSet({
      workoutId: ineligible,
      setIndex: 2,
      reps: 10,
      weightKg: '50',
      deletedAt: '2026-09-22T13:30:00.000Z',
    });

    const zeroVolume = await addWorkout({
      startedAt: '2026-09-21T12:00:00.000Z',
      endedAt: '2026-09-21T13:00:00.000Z',
    });
    await addSet({ workoutId: zeroVolume, setIndex: 1, reps: 5, weightKg: '0' });

    const summary = await getProgressSummary(userId, 'week', NOW);
    const volumeByWorkout = new Map(
      summary.sessions.map((session) => [session.workoutId, session.totalVolumeKg]),
    );

    expect(volumeByWorkout.get(withVolume)).toBe('109');
    expect(volumeByWorkout.get(zeroVolume)).toBe('0');
    expect(volumeByWorkout.get(noSets)).toBeNull();
    expect(volumeByWorkout.get(ineligible)).toBeNull();
  });

  it('aligns per-session volume by real workout id even when the strength window excludes the session', async () => {
    const late = await addWorkout({
      startedAt: '2026-09-28T02:30:00.000Z',
      endedAt: '2026-09-28T03:30:00.000Z',
    });
    await addSet({ workoutId: late, setIndex: 1, reps: 8, weightKg: '15' });

    const summary = await getProgressSummary(userId, 'week', NOW);

    expect(summary.sessions.map((session) => session.workoutId)).toEqual([late]);
    expect(summary.sessions[0].totalVolumeKg).toBe('120');
    expect(summary.strength.points).toEqual([]);
  });
});
