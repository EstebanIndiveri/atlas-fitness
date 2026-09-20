import { beforeEach, describe, expect, it } from '@jest/globals';

import { db } from '@/lib/db/client';
import {
  exercises,
  routineExercises,
  routines,
  users,
  workoutSets,
  workouts,
} from '@/lib/db/schema';
import { getTodayRoutineCompletion } from './routine-completion';

// 2026-09-24T15:00:00Z is 2026-09-24 12:00 in Córdoba (UTC-3).
const MIDDAY_UTC = new Date('2026-09-24T15:00:00.000Z');
// 2026-09-23T15:00:00Z is the previous Córdoba day.
const YESTERDAY_UTC = new Date('2026-09-23T15:00:00.000Z');

describe('getTodayRoutineCompletion', () => {
  let userId: number;
  let routineId: number;
  let exerciseIds: number[];

  beforeEach(async () => {
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(routineExercises);
    await db.delete(routines);
    await db.delete(exercises);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({ name: 'Completion User', email: 'completion@example.com', passwordHash: 'hash' })
      .returning();
    userId = user.id;

    const insertedExercises = await db
      .insert(exercises)
      .values([
        { slug: 'ex-a', name: 'Ejercicio A', muscleGroup: 'Test', instructions: 'x', isSystem: true },
        { slug: 'ex-b', name: 'Ejercicio B', muscleGroup: 'Test', instructions: 'x', isSystem: true },
        { slug: 'ex-c', name: 'Ejercicio C', muscleGroup: 'Test', instructions: 'x', isSystem: true },
      ])
      .returning();
    exerciseIds = insertedExercises.map((row) => row.id);

    const [routine] = await db
      .insert(routines)
      .values({ slug: 'routine-a', name: 'Rutina A', isSystem: true })
      .returning();
    routineId = routine.id;

    await db.insert(routineExercises).values(
      exerciseIds.map((exerciseId, index) => ({
        routineId,
        exerciseId,
        sortOrder: index,
        targetSets: 3,
        targetReps: 10,
      })),
    );
  });

  async function addWorkout(startedAt: Date): Promise<number> {
    const [workout] = await db
      .insert(workouts)
      .values({ userId, routineId, startedAt })
      .returning();
    return workout.id;
  }

  it('returns total with zero completed when nothing was logged today', async () => {
    const result = await getTodayRoutineCompletion(userId, routineId, MIDDAY_UTC);
    expect(result).toEqual({ completed: 0, total: 3 });
  });

  it('counts distinct routine exercises with a completed set today', async () => {
    const workoutId = await addWorkout(MIDDAY_UTC);
    await db.insert(workoutSets).values([
      { workoutId, exerciseId: exerciseIds[0], setIndex: 0, reps: 10, weightKg: '20', completed: true },
      { workoutId, exerciseId: exerciseIds[0], setIndex: 1, reps: 10, weightKg: '20', completed: true },
      { workoutId, exerciseId: exerciseIds[1], setIndex: 2, reps: 8, weightKg: '30', completed: true },
    ]);

    const result = await getTodayRoutineCompletion(userId, routineId, MIDDAY_UTC);
    expect(result).toEqual({ completed: 2, total: 3 });
  });

  it('ignores non-completed and soft-deleted sets', async () => {
    const workoutId = await addWorkout(MIDDAY_UTC);
    await db.insert(workoutSets).values([
      { workoutId, exerciseId: exerciseIds[0], setIndex: 0, reps: 10, weightKg: '20', completed: false },
      {
        workoutId,
        exerciseId: exerciseIds[1],
        setIndex: 1,
        reps: 10,
        weightKg: '20',
        completed: true,
        deletedAt: new Date(),
      },
    ]);

    const result = await getTodayRoutineCompletion(userId, routineId, MIDDAY_UTC);
    expect(result).toEqual({ completed: 0, total: 3 });
  });

  it('ignores sets logged on a different Córdoba day', async () => {
    const workoutId = await addWorkout(YESTERDAY_UTC);
    await db.insert(workoutSets).values([
      { workoutId, exerciseId: exerciseIds[0], setIndex: 0, reps: 10, weightKg: '20', completed: true },
    ]);

    const result = await getTodayRoutineCompletion(userId, routineId, MIDDAY_UTC);
    expect(result).toEqual({ completed: 0, total: 3 });
  });

  it('ignores soft-deleted workouts', async () => {
    const [workout] = await db
      .insert(workouts)
      .values({ userId, routineId, startedAt: MIDDAY_UTC, deletedAt: new Date() })
      .returning();
    await db.insert(workoutSets).values([
      {
        workoutId: workout.id,
        exerciseId: exerciseIds[0],
        setIndex: 0,
        reps: 10,
        weightKg: '20',
        completed: true,
      },
    ]);

    const result = await getTodayRoutineCompletion(userId, routineId, MIDDAY_UTC);
    expect(result).toEqual({ completed: 0, total: 3 });
  });

  it('does not count sets for exercises outside the routine', async () => {
    const [extra] = await db
      .insert(exercises)
      .values({ slug: 'ex-extra', name: 'Extra', muscleGroup: 'Test', instructions: 'x', isSystem: true })
      .returning();
    const workoutId = await addWorkout(MIDDAY_UTC);
    await db.insert(workoutSets).values([
      { workoutId, exerciseId: extra.id, setIndex: 0, reps: 10, weightKg: '20', completed: true },
    ]);

    const result = await getTodayRoutineCompletion(userId, routineId, MIDDAY_UTC);
    expect(result).toEqual({ completed: 0, total: 3 });
  });

  it('returns zero total for a routine without exercises', async () => {
    const [empty] = await db
      .insert(routines)
      .values({ slug: 'routine-empty', name: 'Vacía', isSystem: true })
      .returning();

    const result = await getTodayRoutineCompletion(userId, empty.id, MIDDAY_UTC);
    expect(result).toEqual({ completed: 0, total: 0 });
  });
});
