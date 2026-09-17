import { describe, it, expect, beforeEach } from '@jest/globals';
import * as workoutSetsService from './workout-sets';
import * as workoutsService from './workouts';
import { db } from '@/lib/db/client';
import { users, workouts, workoutSets, exercises, userStreaks, telegramLinkCodes } from '@/lib/db/schema';

describe('Workout Sets Service', () => {
  let testUserId: number;
  let testExerciseId: number;

  beforeEach(async () => {
    // Clean up test data - delete in order respecting foreign keys
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(exercises);
    await db.delete(userStreaks);
    await db.delete(telegramLinkCodes);
    await db.delete(users);

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        name: 'Test User',
        email: 'test-sets@test.com',
        passwordHash: 'hash',
      })
      .returning();
    testUserId = user.id;

    // Create test exercise
    const [exercise] = await db
      .insert(exercises)
      .values({
        slug: 'test-exercise',
        name: 'Test Exercise',
        muscleGroup: 'Test',
        instructions: 'Test instructions',
        isSystem: true,
      })
      .returning();
    testExerciseId = exercise.id;
  });

  describe('createWorkoutSet', () => {
    it('should create a new workout set with valid data', async () => {
      const workout = await workoutsService.createWorkout(testUserId);

      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
      });

      expect(set.id).toBeDefined();
      expect(set.workoutId).toBe(workout.id);
      expect(set.exerciseId).toBe(testExerciseId);
      expect(set.setIndex).toBe(1);
      expect(set.reps).toBe(10);
      expect(set.weightKg).toBe('100');
    });

    it('should throw CONFLICT for duplicate set_index (TOCTOU test)', async () => {
      const workout = await workoutsService.createWorkout(testUserId);

      // First set succeeds
      await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
      });

      // Second set with same set_index should fail with CONFLICT
      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 12,
          weightKg: '105',
        })
      ).rejects.toThrow('Ya existe una serie con este índice en el entrenamiento');
    });

    it('should validate weight_kg format', async () => {
      const workout = await workoutsService.createWorkout(testUserId);

      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 10,
          weightKg: 'invalid',
        })
      ).rejects.toThrow('Peso inválido');
    });

    it('should validate reps is positive', async () => {
      const workout = await workoutsService.createWorkout(testUserId);

      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 0,
          weightKg: '100',
        })
      ).rejects.toThrow('Las repeticiones deben ser mayor a 0');
    });

    it('should throw NOT_FOUND if workout does not exist', async () => {
      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: 999,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 10,
          weightKg: '100',
        })
      ).rejects.toThrow('Entrenamiento no encontrado');
    });

    it('should throw FORBIDDEN if workout belongs to another user', async () => {
      const [otherUser] = await db
        .insert(users)
        .values({
          name: 'Other User',
          email: 'other-sets@test.com',
          passwordHash: 'hash',
        })
        .returning();

      const workout = await workoutsService.createWorkout(otherUser.id);

      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 10,
          weightKg: '100',
        })
      ).rejects.toThrow('No tienes permiso para modificar este entrenamiento');
    });

    it('should throw VALIDATION if workout is already ended', async () => {
      const workout = await workoutsService.createWorkout(testUserId);
      await workoutsService.updateWorkout(workout.id, testUserId, { endedAt: new Date() });

      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 10,
          weightKg: '100',
        })
      ).rejects.toThrow('No puedes agregar series a un entrenamiento finalizado');
    });
  });

  describe('updateWorkoutSet', () => {
    it('should update a workout set', async () => {
      const workout = await workoutsService.createWorkout(testUserId);
      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
      });

      const updated = await workoutSetsService.updateWorkoutSet({
        setId: set.id,
        userId: testUserId,
        reps: 12,
        weightKg: '105',
      });

      expect(updated.reps).toBe(12);
      expect(updated.weightKg).toBe('105');
    });

    it('should throw FORBIDDEN if set belongs to workout of another user', async () => {
      const [otherUser] = await db
        .insert(users)
        .values({
          name: 'Other User',
          email: 'other-sets2@test.com',
          passwordHash: 'hash',
        })
        .returning();

      const workout = await workoutsService.createWorkout(otherUser.id);
      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: otherUser.id,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
      });

      await expect(
        workoutSetsService.updateWorkoutSet({
          setId: set.id,
          userId: testUserId,
          reps: 12,
        })
      ).rejects.toThrow('No tienes permiso para modificar esta serie');
    });
  });

  describe('deleteWorkoutSet', () => {
    it('should soft delete a workout set', async () => {
      const workout = await workoutsService.createWorkout(testUserId);
      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
      });

      await workoutSetsService.deleteWorkoutSet(set.id, testUserId);

      const sets = await workoutSetsService.listWorkoutSets(workout.id, testUserId);
      expect(sets).toHaveLength(0);
    });

    it('should throw FORBIDDEN if set belongs to workout of another user', async () => {
      const [otherUser] = await db
        .insert(users)
        .values({
          name: 'Other User',
          email: 'other-sets3@test.com',
          passwordHash: 'hash',
        })
        .returning();

      const workout = await workoutsService.createWorkout(otherUser.id);
      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: otherUser.id,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
      });

      await expect(workoutSetsService.deleteWorkoutSet(set.id, testUserId)).rejects.toThrow(
        'No tienes permiso para eliminar esta serie'
      );
    });
  });

  describe('listWorkoutSets', () => {
    it('should list sets for a workout excluding soft deleted', async () => {
      const workout = await workoutsService.createWorkout(testUserId);

      const set1 = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
      });

      const set2 = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 2,
        reps: 10,
        weightKg: '100',
      });

      // Delete set2
      await workoutSetsService.deleteWorkoutSet(set2.id, testUserId);

      const sets = await workoutSetsService.listWorkoutSets(workout.id, testUserId);

      expect(sets).toHaveLength(1);
      expect(sets[0].id).toBe(set1.id);
    });
  });
});
