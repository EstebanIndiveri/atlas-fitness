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

describe('Stats Service', () => {
  let testUserId: number;
  let exercise1Id: number;
  let exercise2Id: number;

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

    // Create test exercises
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

    const [ex2] = await db
      .insert(exercises)
      .values({
        slug: 'squat',
        name: 'Sentadilla',
        muscleGroup: 'Piernas',
        instructions: 'Test',
        isSystem: true,
      })
      .returning();
    exercise2Id = ex2.id;
  });

  describe('getPersonalRecords', () => {
    it('should return empty array if user has no sets', async () => {
      const prs = await statsService.getPersonalRecords(testUserId);
      expect(prs).toEqual([]);
    });

    it('should calculate PR correctly with lexicographic-resistant weights', async () => {
      // This tests the fix for MAX(text) being lexicographic in SQLite
      // Weights: "9", "80", "80.5" → PR should be "80.5" (not "9" which is lexicographically largest)

      const workout1 = await workoutsService.createWorkout(testUserId);
      await new Promise((resolve) => setTimeout(resolve, 100)); // Ensure different timestamps

      // Add set with weight "9"
      await workoutSetsService.createWorkoutSet({
        workoutId: workout1.id,
        userId: testUserId,
        exerciseId: exercise1Id,
        setIndex: 1,
        reps: 10,
        weightKg: '9',
      });

      await workoutsService.updateWorkout(workout1.id, testUserId, { endedAt: new Date() });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const workout2 = await workoutsService.createWorkout(testUserId);

      // Add set with weight "80"
      await workoutSetsService.createWorkoutSet({
        workoutId: workout2.id,
        userId: testUserId,
        exerciseId: exercise1Id,
        setIndex: 1,
        reps: 10,
        weightKg: '80',
      });

      await workoutsService.updateWorkout(workout2.id, testUserId, { endedAt: new Date() });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const workout3 = await workoutsService.createWorkout(testUserId);

      // Add set with weight "80.5"
      await workoutSetsService.createWorkoutSet({
        workoutId: workout3.id,
        userId: testUserId,
        exerciseId: exercise1Id,
        setIndex: 1,
        reps: 10,
        weightKg: '80.5',
      });

      const prs = await statsService.getPersonalRecords(testUserId);

      expect(prs).toHaveLength(1);
      expect(prs[0].exerciseId).toBe(exercise1Id);
      expect(prs[0].maxWeightKg).toBe('80.5');
    });

    it('should handle tie on weight with most recent workout winning', async () => {
      const workout1 = await workoutsService.createWorkout(testUserId);
      await new Promise((resolve) => setTimeout(resolve, 100)); // Ensure different timestamps

      await workoutSetsService.createWorkoutSet({
        workoutId: workout1.id,
        userId: testUserId,
        exerciseId: exercise1Id,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
      });

      await workoutsService.updateWorkout(workout1.id, testUserId, { endedAt: new Date() });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const workout2 = await workoutsService.createWorkout(testUserId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      await workoutSetsService.createWorkoutSet({
        workoutId: workout2.id,
        userId: testUserId,
        exerciseId: exercise1Id,
        setIndex: 1,
        reps: 8,
        weightKg: '100', // Same weight
      });

      const prs = await statsService.getPersonalRecords(testUserId);

      expect(prs).toHaveLength(1);
      expect(prs[0].maxWeightKg).toBe('100');
      // Verify most recent workout wins the tie
      expect(prs[0].workoutId).toBeGreaterThan(workout1.id);
    });

    it('should return PRs grouped by exercise', async () => {
      const workout = await workoutsService.createWorkout(testUserId);

      // Exercise 1 PR
      await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: exercise1Id,
        setIndex: 1,
        reps: 10,
        weightKg: '120.5',
      });

      // Exercise 2 PR
      await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: exercise2Id,
        setIndex: 2,
        reps: 10,
        weightKg: '150',
      });

      const prs = await statsService.getPersonalRecords(testUserId);

      expect(prs).toHaveLength(2);

      const pr1 = prs.find((pr) => pr.exerciseId === exercise1Id);
      expect(pr1?.maxWeightKg).toBe('120.5');

      const pr2 = prs.find((pr) => pr.exerciseId === exercise2Id);
      expect(pr2?.maxWeightKg).toBe('150');
    });
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
      });

      await workoutSetsService.createWorkoutSet({
        workoutId: workout1.id,
        userId: testUserId,
        exerciseId: exercise1Id,
        setIndex: 2,
        reps: 8,
        weightKg: '105',
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

  describe('isPR', () => {
    it('should return true if weight equals or exceeds current PR', async () => {
      const workout = await workoutsService.createWorkout(testUserId);

      await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: exercise1Id,
        setIndex: 1,
        reps: 10,
        weightKg: '120',
      });

      const isEqual = await statsService.isPR(testUserId, exercise1Id, '120');
      const isExceeds = await statsService.isPR(testUserId, exercise1Id, '125');

      expect(isEqual).toBe(true);
      expect(isExceeds).toBe(true);
    });

    it('should return false if weight is less than current PR', async () => {
      const workout = await workoutsService.createWorkout(testUserId);

      await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: exercise1Id,
        setIndex: 1,
        reps: 10,
        weightKg: '120',
      });

      const result = await statsService.isPR(testUserId, exercise1Id, '115');

      expect(result).toBe(false);
    });

    it('should return true if no previous PR exists', async () => {
      const result = await statsService.isPR(testUserId, exercise1Id, '100');
      expect(result).toBe(true);
    });
  });
});
