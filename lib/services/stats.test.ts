import { describe, it, expect, beforeEach } from '@jest/globals';
import * as statsService from './stats';
import * as workoutsService from './workouts';
import * as workoutSetsService from './workout-sets';
import { db } from '@/lib/db/client';
import {
  sessions,
  users,
  workouts,
  workoutSets,
  exercises,
  routineExercises,
  routines,
  userStreaks,
  telegramLinkCodes,
  dailyCheckins,
  streakNudges,
  botMessages,
} from '@/lib/db/schema';

/**
 * Raw exercise-history compatibility surface (v0.12).
 *
 * The legacy `getPersonalRecords`/`isPR` contract was retired: there must be no
 * bare-weight PR truth in this module. Its removal is asserted by the absence of
 * the exports in the type system and by the progression service tests.
 */
describe('Stats Service', () => {
  let testUserId: number;
  let exercise1Id: number;

  beforeEach(async () => {
    // Clean up test data - delete in order respecting foreign keys
    await db.delete(streakNudges);
    await db.delete(dailyCheckins);
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(routineExercises);
    await db.delete(routines);
    await db.delete(exercises);
    await db.delete(userStreaks);
    await db.delete(botMessages);
    await db.delete(telegramLinkCodes);
    await db.delete(sessions);
    await db.delete(users);

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        name: 'Test User',
        email: 'test-stats@test.com',
        passwordHash: 'hash',
      })
      .returning();
    testUserId = user.id;

    // Create test exercise
    const [ex1] = await db
      .insert(exercises)
      .values({
        slug: 'bench-press',
        name: 'Press Banca',
        muscleGroup: 'Pecho',
        instructions: 'Test',
        isSystem: true,
      })
      .returning();
    exercise1Id = ex1.id;
  });

  describe('getExerciseHistory', () => {
    it('should return exercise history for a user', async () => {
      const workout1 = await workoutsService.createWorkout(testUserId);

      await workoutSetsService.createWorkoutSet({
        workoutId: workout1.id,
        userId: testUserId,
        exerciseId: exercise1Id,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
        semanticCaptureVersion: 1,
        loadMode: 'external',
        amountBasis: 'total',
        side: 'bilateral',
        setPurpose: 'working',
        repCountBasis: null,
      });

      await workoutSetsService.createWorkoutSet({
        workoutId: workout1.id,
        userId: testUserId,
        exerciseId: exercise1Id,
        setIndex: 2,
        reps: 8,
        weightKg: '105',
        semanticCaptureVersion: 1,
        loadMode: 'external',
        amountBasis: 'total',
        side: 'bilateral',
        setPurpose: 'working',
        repCountBasis: null,
      });

      const history = await statsService.getExerciseHistory(exercise1Id, testUserId);

      expect(history.exerciseId).toBe(exercise1Id);
      expect(history.exerciseName).toBe('Press Banca');
      expect(history.history).toHaveLength(2);
    });

    it('should throw NOT_FOUND if exercise does not exist', async () => {
      await expect(statsService.getExerciseHistory(999, testUserId)).rejects.toThrow(
        'Ejercicio no encontrado'
      );
    });

    it('should throw NOT_FOUND for another user custom exercise', async () => {
      const [otherUser] = await db
        .insert(users)
        .values({
          name: 'Other Stats',
          email: 'other-stats@test.com',
          passwordHash: 'hash',
        })
        .returning();
      const [foreign] = await db
        .insert(exercises)
        .values({
          slug: 'foreign-stats',
          name: 'Ajeno stats',
          muscleGroup: 'Test',
          instructions: 'x',
          isSystem: false,
          userId: otherUser.id,
        })
        .returning();

      await expect(statsService.getExerciseHistory(foreign.id, testUserId)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Ejercicio no encontrado',
      });
    });

    it('should return empty history if no sets for exercise', async () => {
      const history = await statsService.getExerciseHistory(exercise1Id, testUserId);

      expect(history.exerciseId).toBe(exercise1Id);
      expect(history.history).toEqual([]);
    });
  });

  it('exposes no bare-weight PR truth (getPersonalRecords/isPR retired)', () => {
    const service = statsService as unknown as Record<string, unknown>;
    expect(service.getPersonalRecords).toBeUndefined();
    expect(service.isPR).toBeUndefined();
  });
});
