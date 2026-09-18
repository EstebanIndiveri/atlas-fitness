/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { db } from '@/lib/db/client';
import {
  sessions,
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
import { getRoutineById, listRoutines } from '@/lib/services/routines';
import { createWorkout } from '@/lib/services/workouts';
import { AppError } from '@/types/errors';

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
  await db.delete(sessions);
    await db.delete(users);
}

describe('Routines service', () => {
  let userId: number;
  let benchId: number;
  let squatId: number;

  beforeEach(async () => {
    await wipe();

    const [user] = await db
      .insert(users)
      .values({ name: 'Routines User', email: 'routines@test.com', passwordHash: 'hash' })
      .returning();
    userId = user.id;

    const [bench] = await db
      .insert(exercises)
      .values({
        slug: 'bench-press',
        name: 'Press Banca',
        muscleGroup: 'Pecho',
        instructions: 'x',
        imageUrl: 'https://example.com/bench.png',
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
        description: 'Dos ejercicios para smoke',
        kind: 'gym',
        restSeconds: 45,
        isSystem: true,
      })
      .returning();

    await db.insert(routineExercises).values([
      {
        routineId: routine.id,
        exerciseId: benchId,
        sortOrder: 1,
        targetSets: 1,
        targetReps: 5,
      },
      {
        routineId: routine.id,
        exerciseId: squatId,
        sortOrder: 2,
        targetSets: 1,
        targetReps: 5,
      },
    ]);
  });

  it('lists seeded routines with ordered exercises and media', async () => {
    const list = await listRoutines();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Full body exprés');
    expect(list[0].restSeconds).toBe(45);
    expect(list[0].exercises.map((item) => item.exerciseName)).toEqual([
      'Press Banca',
      'Sentadilla',
    ]);
    expect(list[0].exercises[0].imageUrl).toBe('https://example.com/bench.png');
    expect(list[0].exercises[0].targetSets).toBe(1);
    expect(list[0].exercises[0].targetReps).toBe(5);
  });

  it('throws NOT_FOUND for unknown routines', async () => {
    await expect(getRoutineById(99999)).rejects.toBeInstanceOf(AppError);
  });

  it('createWorkout stores routineId when the routine exists', async () => {
    const list = await listRoutines();
    const workout = await createWorkout(userId, list[0].id);
    expect(workout.routineId).toBe(list[0].id);
    expect(workout.endedAt).toBeNull();
  });
});
