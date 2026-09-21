import { describe, it, expect, beforeEach } from '@jest/globals';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  coachRecommendations,
  dailyCheckins,
  exercises,
  routineExercises,
  routines,
  sessions,
  streakNudges,
  telegramLinkCodes,
  userStreaks,
  users,
  workoutSets,
  workouts,
} from '@/lib/db/schema';
import { getWorkoutById } from '@/lib/services/workouts';
import type { CoachAdaptationResult } from '@/types/coach';

import { startAdaptedWorkout } from './coach-adaptation-apply';

async function seedRoutineWithThreeExercises(userId: number): Promise<{
  routineId: number;
  exerciseIds: [number, number, number];
}> {
  const inserted = await db
    .insert(exercises)
    .values([
      { slug: 'ex-a', name: 'Press Banca', muscleGroup: 'chest', instructions: 'x', isSystem: true },
      { slug: 'ex-b', name: 'Sentadilla', muscleGroup: 'legs', instructions: 'x', isSystem: true },
      { slug: 'ex-c', name: 'Remo', muscleGroup: 'back', instructions: 'x', isSystem: true },
    ])
    .returning();
  const exerciseIds: [number, number, number] = [inserted[0].id, inserted[1].id, inserted[2].id];

  const [routine] = await db
    .insert(routines)
    .values({ userId, slug: 'full-body-adapt', name: 'Full body', kind: 'gym', restSeconds: 90, isSystem: false })
    .returning();

  await db.insert(routineExercises).values([
    { routineId: routine.id, exerciseId: exerciseIds[0], sortOrder: 0, targetSets: 3, targetReps: 10 },
    { routineId: routine.id, exerciseId: exerciseIds[1], sortOrder: 1, targetSets: 3, targetReps: 10 },
    { routineId: routine.id, exerciseId: exerciseIds[2], sortOrder: 2, targetSets: 3, targetReps: 10 },
  ]);

  return { routineId: routine.id, exerciseIds };
}

function buildResult(
  exerciseIds: readonly number[],
  removedId: number,
): CoachAdaptationResult {
  return {
    original: { exerciseCount: 3, setCount: 9, estMinutes: 45 },
    adapted: { exerciseCount: 2, setCount: 6, estMinutes: 30 },
    exerciseDeltas: exerciseIds.map((exerciseId, index) => ({
      exerciseId,
      name: `Ejercicio ${index}`,
      action: exerciseId === removedId ? 'removed' : 'kept',
      fromSets: 3,
      toSets: exerciseId === removedId ? 0 : 3,
    })),
    reason: 'Menos tiempo disponible hoy',
    source: 'deterministic',
  };
}

describe('startAdaptedWorkout', () => {
  let userId: number;

  beforeEach(async () => {
    await db.delete(coachRecommendations);
    await db.delete(dailyCheckins);
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(routineExercises);
    await db.delete(routines);
    await db.delete(streakNudges);
    await db.delete(userStreaks);
    await db.delete(telegramLinkCodes);
    await db.delete(sessions);
    await db.delete(exercises);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({ name: 'Adapt User', email: 'adapt@test.com', passwordHash: 'hash' })
      .returning();
    userId = user.id;
  });

  it('creates the workout, records an accepted recommendation, and skips removed exercises', async () => {
    const { routineId, exerciseIds } = await seedRoutineWithThreeExercises(userId);
    const removedId = exerciseIds[1];
    const result = buildResult(exerciseIds, removedId);

    const { workout, recommendation } = await startAdaptedWorkout({
      userId,
      routineId,
      result,
      contextSnapshot: { freeText: 'Tengo 30 minutos' },
    });

    expect(workout.routineId).toBe(routineId);
    expect(workout.endedAt).toBeNull();

    expect(recommendation).not.toBeNull();
    expect(recommendation?.decision).toBe('accepted');
    expect(recommendation?.workoutId).toBe(workout.id);

    const persisted = await db.query.coachRecommendations.findFirst({
      where: eq(coachRecommendations.workoutId, workout.id),
    });
    expect(persisted?.decision).toBe('accepted');
    expect(persisted?.decidedAt).not.toBeNull();

    const loaded = await getWorkoutById(workout.id, userId);
    expect(loaded.queue.skippedExerciseIds).toContain(removedId);
    expect(loaded.queue.pendingExerciseIds).not.toContain(removedId);
    expect(loaded.queue.pendingExerciseIds).toEqual([exerciseIds[0], exerciseIds[2]]);
  });

  it('does not seed a skipped queue when there are no removed exercises', async () => {
    const { routineId, exerciseIds } = await seedRoutineWithThreeExercises(userId);
    const result: CoachAdaptationResult = {
      original: { exerciseCount: 3, setCount: 9, estMinutes: 45 },
      adapted: { exerciseCount: 3, setCount: 6, estMinutes: 35 },
      exerciseDeltas: exerciseIds.map((exerciseId, index) => ({
        exerciseId,
        name: `Ejercicio ${index}`,
        action: 'reduced',
        fromSets: 3,
        toSets: 2,
      })),
      reason: 'Bajá la carga hoy',
      source: 'deterministic',
    };

    const { workout, recommendation } = await startAdaptedWorkout({ userId, routineId, result });

    expect(recommendation?.decision).toBe('accepted');
    const loaded = await getWorkoutById(workout.id, userId);
    expect(loaded.queue.skippedExerciseIds).toEqual([]);
    expect(loaded.queue.pendingExerciseIds).toEqual(exerciseIds);
  });

  it('rejects an unknown routine with VALIDATION and creates no workout', async () => {
    const result = buildResult([1, 2, 3], 2);
    await expect(
      startAdaptedWorkout({ userId, routineId: 999999, result }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    const anyWorkout = await db.query.workouts.findFirst({ where: eq(workouts.userId, userId) });
    expect(anyWorkout).toBeUndefined();
  });
});
