import { describe, it, expect, beforeEach } from '@jest/globals';
import * as workoutsService from './workouts';
import { db } from '@/lib/db/client';
import {
  users,
  workouts,
  workoutSets,
  userStreaks,
  telegramLinkCodes,
  dailyCheckins,
} from '@/lib/db/schema';

describe('Workouts Service', () => {
  let testUserId: number;

  beforeEach(async () => {
    // Clean up test data - delete in order respecting foreign keys
    await db.delete(dailyCheckins);
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(userStreaks);
    await db.delete(telegramLinkCodes);
    await db.delete(users);

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        name: 'Test User',
        email: 'test-workouts@test.com',
        passwordHash: 'hash',
      })
      .returning();
    testUserId = user.id;
  });

  describe('createWorkout', () => {
    it('should create a new workout with current timestamp', async () => {
      const workout = await workoutsService.createWorkout(testUserId);

      expect(workout.id).toBeDefined();
      expect(workout.userId).toBe(testUserId);
      expect(workout.startedAt).toBeInstanceOf(Date);
      expect(workout.endedAt).toBeNull();
      expect(workout.deletedAt).toBeNull();
    });
  });

  describe('listWorkouts', () => {
    it('should list workouts for a user excluding soft deleted', async () => {
      // Create active workout
      const active = await workoutsService.createWorkout(testUserId);

      // Create and soft delete another
      const deleted = await workoutsService.createWorkout(testUserId);
      await workoutsService.deleteWorkout(deleted.id, testUserId);

      const list = await workoutsService.listWorkouts(testUserId);

      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(active.id);
    });

    it('should return empty array if user has no workouts', async () => {
      const list = await workoutsService.listWorkouts(testUserId);
      expect(list).toEqual([]);
    });
  });

  describe('getWorkoutById', () => {
    it('should get a workout with its sets', async () => {
      const workout = await workoutsService.createWorkout(testUserId);

      const result = await workoutsService.getWorkoutById(workout.id, testUserId);

      expect(result.id).toBe(workout.id);
      expect(result.sets).toEqual([]);
    });

    it('should throw NOT_FOUND if workout does not exist', async () => {
      await expect(workoutsService.getWorkoutById(999, testUserId)).rejects.toThrow(
        'Entrenamiento no encontrado'
      );
    });

    it('should throw FORBIDDEN if workout belongs to another user', async () => {
      const [otherUser] = await db
        .insert(users)
        .values({
          name: 'Other User',
          email: 'other@test.com',
          passwordHash: 'hash',
        })
        .returning();

      const workout = await workoutsService.createWorkout(otherUser.id);

      await expect(workoutsService.getWorkoutById(workout.id, testUserId)).rejects.toThrow(
        'No tienes permiso para acceder a este entrenamiento'
      );
    });

    it('should throw NOT_FOUND if workout is soft deleted', async () => {
      const workout = await workoutsService.createWorkout(testUserId);
      await workoutsService.deleteWorkout(workout.id, testUserId);

      await expect(workoutsService.getWorkoutById(workout.id, testUserId)).rejects.toThrow(
        'Entrenamiento no encontrado'
      );
    });
  });

  describe('updateWorkout', () => {
    it('should update workout endedAt, note, and mood', async () => {
      const workout = await workoutsService.createWorkout(testUserId);
      const endedAt = new Date();

      const updated = await workoutsService.updateWorkout(workout.id, testUserId, {
        endedAt,
        note: 'Buen entrenamiento',
        mood: 5,
      });

      expect(updated.endedAt).toBeDefined();
      expect(updated.endedAt).toBeInstanceOf(Date);
      expect(updated.note).toBe('Buen entrenamiento');
      expect(updated.mood).toBe(5);
    });

    it('should validate mood is between 1 and 5', async () => {
      const workout = await workoutsService.createWorkout(testUserId);

      await expect(
        workoutsService.updateWorkout(workout.id, testUserId, { mood: 0 })
      ).rejects.toThrow('El estado de ánimo debe estar entre 1 y 5');

      await expect(
        workoutsService.updateWorkout(workout.id, testUserId, { mood: 6 })
      ).rejects.toThrow('El estado de ánimo debe estar entre 1 y 5');
    });

    it('should throw FORBIDDEN if workout belongs to another user', async () => {
      const [otherUser] = await db
        .insert(users)
        .values({
          name: 'Other User',
          email: 'other2@test.com',
          passwordHash: 'hash',
        })
        .returning();

      const workout = await workoutsService.createWorkout(otherUser.id);

      await expect(
        workoutsService.updateWorkout(workout.id, testUserId, { note: 'Test' })
      ).rejects.toThrow('No tienes permiso para modificar este entrenamiento');
    });
  });

  describe('deleteWorkout', () => {
    it('should soft delete a workout', async () => {
      const workout = await workoutsService.createWorkout(testUserId);

      await workoutsService.deleteWorkout(workout.id, testUserId);

      const list = await workoutsService.listWorkouts(testUserId);
      expect(list).toHaveLength(0);
    });

    it('should throw FORBIDDEN if workout belongs to another user', async () => {
      const [otherUser] = await db
        .insert(users)
        .values({
          name: 'Other User',
          email: 'other3@test.com',
          passwordHash: 'hash',
        })
        .returning();

      const workout = await workoutsService.createWorkout(otherUser.id);

      await expect(workoutsService.deleteWorkout(workout.id, testUserId)).rejects.toThrow(
        'No tienes permiso para eliminar este entrenamiento'
      );
    });
  });

  describe('getActiveWorkout', () => {
    it('should return the active workout (endedAt is null)', async () => {
      const workout = await workoutsService.createWorkout(testUserId);

      const active = await workoutsService.getActiveWorkout(testUserId);

      expect(active).not.toBeNull();
      expect(active?.id).toBe(workout.id);
    });

    it('should return null if no active workout exists', async () => {
      const active = await workoutsService.getActiveWorkout(testUserId);
      expect(active).toBeNull();
    });

    it('should return null if only finished workouts exist', async () => {
      const workout = await workoutsService.createWorkout(testUserId);
      await workoutsService.updateWorkout(workout.id, testUserId, { endedAt: new Date() });

      const active = await workoutsService.getActiveWorkout(testUserId);
      expect(active).toBeNull();
    });
  });
});
