/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { db } from '@/lib/db/client';
import {
  botMessages,
  dailyCheckins,
  exercises,
  routineExercises,
  routines,
  streakNudges,
  telegramLinkCodes,
  users,
  userStreaks,
  workouts,
  workoutSets,
} from '@/lib/db/schema';
import {
  completedExerciseIdsForRoutine,
  getGuidedCloseSummary,
  isExerciseComplete,
  suggestNextExerciseForWorkout,
} from '@/lib/services/guided-session';
import { createWorkout } from '@/lib/services/workouts';
import { createWorkoutSet } from '@/lib/services/workout-sets';
import { getRoutineById } from '@/lib/services/routines';
import type { RoutineSummary } from '@/types/routine';

async function wipe() {
  await db.delete(workoutSets);
  await db.delete(workouts);
  await db.delete(routineExercises);
  await db.delete(routines);
  await db.delete(dailyCheckins);
  await db.delete(streakNudges);
  await db.delete(userStreaks);
  await db.delete(botMessages);
  await db.delete(telegramLinkCodes);
  await db.delete(exercises);
  await db.delete(users);
}

describe('guided session helpers', () => {
  it('treats an exercise as complete at target sets', () => {
    expect(isExerciseComplete(0, 3)).toBe(false);
    expect(isExerciseComplete(3, 3)).toBe(true);
    expect(isExerciseComplete(4, 3)).toBe(true);
  });

  it('collects completed exercise ids from logged sets', () => {
    const routine = {
      exercises: [
        { exerciseId: 1, targetSets: 2 },
        { exerciseId: 2, targetSets: 1 },
      ],
    } as RoutineSummary;

    expect(completedExerciseIdsForRoutine(routine, [{ exerciseId: 1 }])).toEqual([]);
    expect(
      completedExerciseIdsForRoutine(routine, [
        { exerciseId: 1 },
        { exerciseId: 1 },
        { exerciseId: 2 },
      ]),
    ).toEqual([1, 2]);
  });
});

describe('suggestNextExerciseForWorkout', () => {
  let userId: number;
  let benchId: number;
  let squatId: number;
  let routineId: number;

  beforeEach(async () => {
    await wipe();
    const [user] = await db
      .insert(users)
      .values({ name: 'Guided', email: 'guided@test.com', passwordHash: 'hash' })
      .returning();
    userId = user.id;

    const [bench] = await db
      .insert(exercises)
      .values({
        slug: 'bench-press',
        name: 'Press Banca',
        muscleGroup: 'Pecho',
        instructions: 'x',
        isSystem: true,
      })
      .returning();
    const [squat] = await db
      .insert(exercises)
      .values({
        slug: 'squat',
        name: 'Sentadilla',
        muscleGroup: 'Piernas',
        instructions: 'x',
        isSystem: true,
      })
      .returning();
    benchId = bench.id;
    squatId = squat.id;

    const [routine] = await db
      .insert(routines)
      .values({
        slug: 'full-body-expres',
        name: 'Full body exprés',
        kind: 'gym',
        restSeconds: 30,
        isSystem: true,
      })
      .returning();
    routineId = routine.id;

    await db.insert(routineExercises).values([
      { routineId, exerciseId: benchId, sortOrder: 1, targetSets: 1, targetReps: 5 },
      { routineId, exerciseId: squatId, sortOrder: 2, targetSets: 1, targetReps: 5 },
    ]);
  });

  it('falls back to routine order when Gemini is unavailable', async () => {
    const workout = await createWorkout(userId, routineId);
    await createWorkoutSet({
      workoutId: workout.id,
      userId,
      exerciseId: benchId,
      setIndex: 1,
      reps: 5,
      weightKg: '60',
    });

    const suggestion = await suggestNextExerciseForWorkout(workout.id, userId, {
      geminiFn: async () => null,
    });

    expect(suggestion.source).toBe('fallback');
    expect(suggestion.nextExerciseId).toBe(squatId);
    expect(suggestion.isLast).toBe(true);
  });

  it('uses a valid Gemini pick from remaining exercises', async () => {
    const workout = await createWorkout(userId, routineId);
    await createWorkoutSet({
      workoutId: workout.id,
      userId,
      exerciseId: benchId,
      setIndex: 1,
      reps: 5,
      weightKg: '60',
    });

    const suggestion = await suggestNextExerciseForWorkout(workout.id, userId, {
      geminiFn: async () => ({
        nextExerciseId: squatId,
        isLast: true,
        message: 'Cerrá con sentadilla.',
      }),
    });

    expect(suggestion.source).toBe('gemini');
    expect(suggestion.nextExerciseId).toBe(squatId);
    expect(suggestion.message).toBe('Cerrá con sentadilla.');
  });

  it('ignores Gemini when it suggests an already completed exercise', async () => {
    const workout = await createWorkout(userId, routineId);
    await createWorkoutSet({
      workoutId: workout.id,
      userId,
      exerciseId: benchId,
      setIndex: 1,
      reps: 5,
      weightKg: '60',
    });

    const suggestion = await suggestNextExerciseForWorkout(workout.id, userId, {
      geminiFn: async () => ({
        nextExerciseId: benchId,
        isLast: false,
        message: 'otra banca',
      }),
    });

    expect(suggestion.source).toBe('fallback');
    expect(suggestion.nextExerciseId).toBe(squatId);
  });
});

describe('getGuidedCloseSummary', () => {
  it('compares max weight vs the last ended session of the same exercise', async () => {
    await wipe();
    const [user] = await db
      .insert(users)
      .values({ name: 'Close', email: 'close@test.com', passwordHash: 'hash' })
      .returning();
    const [bench] = await db
      .insert(exercises)
      .values({
        slug: 'bench-press',
        name: 'Press Banca',
        muscleGroup: 'Pecho',
        instructions: 'x',
        isSystem: true,
      })
      .returning();

    const previous = await createWorkout(user.id);
    await createWorkoutSet({
      workoutId: previous.id,
      userId: user.id,
      exerciseId: bench.id,
      setIndex: 1,
      reps: 5,
      weightKg: '80',
    });
    const { updateWorkout } = await import('@/lib/services/workouts');
    await updateWorkout(previous.id, user.id, { endedAt: new Date() });

    const current = await createWorkout(user.id);
    await createWorkoutSet({
      workoutId: current.id,
      userId: user.id,
      exerciseId: bench.id,
      setIndex: 1,
      reps: 5,
      weightKg: '85',
    });

    const summary = await getGuidedCloseSummary(current.id, user.id);
    expect(summary.improvements).toHaveLength(1);
    expect(summary.improvements[0].exerciseName).toBe('Press Banca');
    expect(summary.improvements[0].direction).toBe('up');
    expect(summary.improvements[0].currentMaxKg).toBe('85');
    expect(summary.improvements[0].previousMaxKg).toBe('80');
    expect(summary.improvements[0].deltaKg).toBe('5');
    expect(summary.streak.currentStreak).toBeGreaterThanOrEqual(1);
  });
});

describe('getRoutineById (sanity)', () => {
  it('loads a routine inserted in this file', async () => {
    await wipe();
    const [bench] = await db
      .insert(exercises)
      .values({
        slug: 'bench-press',
        name: 'Press Banca',
        muscleGroup: 'Pecho',
        instructions: 'x',
        isSystem: true,
      })
      .returning();
    const [routine] = await db
      .insert(routines)
      .values({ slug: 'solo', name: 'Solo', kind: 'gym', restSeconds: 60, isSystem: true })
      .returning();
    await db.insert(routineExercises).values({
      routineId: routine.id,
      exerciseId: bench.id,
      sortOrder: 1,
      targetSets: 3,
      targetReps: 8,
    });
    const loaded = await getRoutineById(routine.id);
    expect(loaded.exercises).toHaveLength(1);
  });
});
