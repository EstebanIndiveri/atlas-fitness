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
  sessions,
  streakNudges,
  telegramLinkCodes,
  users,
  userStreaks,
  workoutQueueMutations,
  workouts,
  workoutSets,
} from '@/lib/db/schema';
import {
  applyWorkoutQueueAction,
  EXERCISE_NOT_PENDING_MESSAGE,
  INACTIVE_WORKOUT_MESSAGE,
} from '@/lib/services/session-queue';
import { createWorkout, getWorkoutById, updateWorkout } from '@/lib/services/workouts';
import { createWorkoutSet, listWorkoutSets } from '@/lib/services/workout-sets';
import { AppError } from '@/types/errors';
import { suggestNextExerciseForWorkout } from '@/lib/services/guided-session';

async function wipe() {
  await db.delete(workoutQueueMutations);
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
  await db.delete(sessions);
  await db.delete(users);
}

describe('applyWorkoutQueueAction', () => {
  let userId: number;
  let otherUserId: number;
  let benchId: number;
  let squatId: number;
  let rowId: number;
  let routineId: number;

  beforeEach(async () => {
    await wipe();
    const [user] = await db
      .insert(users)
      .values({ name: 'Queue', email: 'queue@test.com', passwordHash: 'hash' })
      .returning();
    const [other] = await db
      .insert(users)
      .values({ name: 'Other Queue', email: 'other-queue@test.com', passwordHash: 'hash' })
      .returning();
    userId = user.id;
    otherUserId = other.id;

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
    const [row] = await db
      .insert(exercises)
      .values({
        slug: 'row',
        name: 'Remo',
        muscleGroup: 'Espalda',
        instructions: 'x',
        isSystem: true,
      })
      .returning();
    benchId = bench.id;
    squatId = squat.id;
    rowId = row.id;

    const [routine] = await db
      .insert(routines)
      .values({
        slug: 'queue-full',
        name: 'Cola full',
        kind: 'gym',
        restSeconds: 30,
        isSystem: true,
      })
      .returning();
    routineId = routine.id;

    await db.insert(routineExercises).values([
      { routineId, exerciseId: benchId, sortOrder: 1, targetSets: 1, targetReps: 5 },
      { routineId, exerciseId: squatId, sortOrder: 2, targetSets: 1, targetReps: 5 },
      { routineId, exerciseId: rowId, sortOrder: 3, targetSets: 1, targetReps: 5 },
    ]);
  });

  it('skip advances the queue and does not put the exercise back', async () => {
    const workout = await createWorkout(userId, routineId);
    const result = await applyWorkoutQueueAction({
      workoutId: workout.id,
      userId,
      action: 'skip',
      exerciseId: benchId,
      clientMutationId: 'mut-skip-1',
    });

    expect(result.action).toBe('skip');
    expect(result.duplicate).toBe(false);
    expect(result.queue.pendingExerciseIds).toEqual([squatId, rowId]);
    expect(result.queue.skippedExerciseIds).toEqual([benchId]);
    expect(result.queue.heldExerciseIds).toEqual([]);
    expect(result.suggestion.nextExerciseId).toBe(squatId);
    expect(result.suggestion.source).toBe('fallback');

    const reloaded = await getWorkoutById(workout.id, userId);
    expect(reloaded.queue.pendingExerciseIds).toEqual([squatId, rowId]);
    expect(reloaded.queue.skippedExerciseIds).toEqual([benchId]);
  });

  it('hold moves the exercise to the end of pending and keeps it held', async () => {
    const workout = await createWorkout(userId, routineId);
    const result = await applyWorkoutQueueAction({
      workoutId: workout.id,
      userId,
      action: 'hold',
      exerciseId: benchId,
      clientMutationId: 'mut-hold-1',
    });

    expect(result.action).toBe('hold');
    expect(result.queue.pendingExerciseIds).toEqual([squatId, rowId, benchId]);
    expect(result.queue.heldExerciseIds).toEqual([benchId]);
    expect(result.queue.skippedExerciseIds).toEqual([]);
    expect(result.suggestion.nextExerciseId).toBe(squatId);

    const reloaded = await getWorkoutById(workout.id, userId);
    expect(reloaded.queue.pendingExerciseIds).toEqual([squatId, rowId, benchId]);
    expect(reloaded.queue.heldExerciseIds).toEqual([benchId]);
  });

  it('does not delete or patch finished sets (decimal weight_kg stays a string)', async () => {
    const workout = await createWorkout(userId, routineId);
    const logged = await createWorkoutSet({
      workoutId: workout.id,
      userId,
      exerciseId: benchId,
      setIndex: 1,
      reps: 5,
      weightKg: '40.5',
    });

    const before = await listWorkoutSets(workout.id, userId);
    expect(before).toHaveLength(1);
    expect(before[0].weightKg).toBe('40.5');

    const skipped = await applyWorkoutQueueAction({
      workoutId: workout.id,
      userId,
      action: 'skip',
      exerciseId: squatId,
      clientMutationId: 'mut-skip-sets',
    });

    expect(skipped.sets).toEqual([
      expect.objectContaining({
        id: logged.id,
        exerciseId: benchId,
        setIndex: 1,
        reps: 5,
        weightKg: '40.5',
      }),
    ]);

    const after = await listWorkoutSets(workout.id, userId);
    expect(after).toEqual(before);
    expect(after[0].id).toBe(logged.id);
    expect(after[0].weightKg).toBe('40.5');
  });

  it('rejects a non-active workout with VALIDATION', async () => {
    const workout = await createWorkout(userId, routineId);
    await updateWorkout(workout.id, userId, { endedAt: new Date() });

    await expect(
      applyWorkoutQueueAction({
        workoutId: workout.id,
        userId,
        action: 'skip',
        exerciseId: benchId,
        clientMutationId: 'mut-inactive',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      message: INACTIVE_WORKOUT_MESSAGE,
    } satisfies Partial<AppError>);
  });

  it('rejects a foreign workout with FORBIDDEN', async () => {
    const workout = await createWorkout(otherUserId, routineId);

    await expect(
      applyWorkoutQueueAction({
        workoutId: workout.id,
        userId,
        action: 'hold',
        exerciseId: benchId,
        clientMutationId: 'mut-foreign',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    } satisfies Partial<AppError>);
  });

  it('rejects a missing workout with NOT_FOUND', async () => {
    await expect(
      applyWorkoutQueueAction({
        workoutId: 99999,
        userId,
        action: 'skip',
        exerciseId: benchId,
        clientMutationId: 'mut-missing',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    } satisfies Partial<AppError>);
  });

  it('returns duplicate:true for the same clientMutationId and args', async () => {
    const workout = await createWorkout(userId, routineId);
    const first = await applyWorkoutQueueAction({
      workoutId: workout.id,
      userId,
      action: 'skip',
      exerciseId: benchId,
      clientMutationId: 'mut-dup',
    });
    const second = await applyWorkoutQueueAction({
      workoutId: workout.id,
      userId,
      action: 'skip',
      exerciseId: benchId,
      clientMutationId: 'mut-dup',
    });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.queue).toEqual(first.queue);
    expect(second.suggestion).toEqual(first.suggestion);
    expect(second.clientMutationId).toBe('mut-dup');
  });

  it('does not treat a skipped exercise as remaining for ADR-003 next-exercise', async () => {
    const workout = await createWorkout(userId, routineId);
    await applyWorkoutQueueAction({
      workoutId: workout.id,
      userId,
      action: 'skip',
      exerciseId: benchId,
      clientMutationId: 'mut-next',
    });

    const suggestion = await suggestNextExerciseForWorkout(workout.id, userId, {
      geminiFn: async (input) => {
        expect(input.remaining.map((item) => item.id)).toEqual([squatId, rowId]);
        return null;
      },
    });

    expect(suggestion.nextExerciseId).toBe(squatId);
    expect(suggestion.source).toBe('fallback');
  });

  it('rejects skip/hold when the exercise is not pending', async () => {
    const workout = await createWorkout(userId, routineId);
    await applyWorkoutQueueAction({
      workoutId: workout.id,
      userId,
      action: 'skip',
      exerciseId: benchId,
      clientMutationId: 'mut-gone',
    });

    await expect(
      applyWorkoutQueueAction({
        workoutId: workout.id,
        userId,
        action: 'skip',
        exerciseId: benchId,
        clientMutationId: 'mut-gone-2',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      message: EXERCISE_NOT_PENDING_MESSAGE,
    } satisfies Partial<AppError>);
  });
});
