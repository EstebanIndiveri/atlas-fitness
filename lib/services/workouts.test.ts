import { describe, it, expect, beforeEach } from '@jest/globals';
import * as workoutsService from './workouts';
import { db } from '@/lib/db/client';
import {
  sessions,
  users,
  workouts,
  workoutSets,
  userStreaks,
  telegramLinkCodes,
  dailyCheckins,
  streakNudges,
  botMessages,
  routines,
  routineExercises,
} from '@/lib/db/schema';

describe('Workouts Service', () => {
  let testUserId: number;

  beforeEach(async () => {
    // Clean up test data - delete in order respecting foreign keys
    await db.delete(dailyCheckins);
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(streakNudges);
    await db.delete(userStreaks);
    await db.delete(botMessages);
    await db.delete(telegramLinkCodes);
    await db.delete(routineExercises);
    await db.delete(routines);
    await db.delete(sessions);
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

    it('should reject a second active workout with CONFLICT', async () => {
      await workoutsService.createWorkout(testUserId);

      await expect(workoutsService.createWorkout(testUserId)).rejects.toMatchObject({
        code: 'CONFLICT',
        message: 'Ya tienes un entrenamiento en curso',
      });
    });

    it('should allow a new workout after the previous one is finished', async () => {
      const first = await workoutsService.createWorkout(testUserId);
      await workoutsService.updateWorkout(first.id, testUserId, { endedAt: new Date() });

      const second = await workoutsService.createWorkout(testUserId);
      expect(second.id).not.toBe(first.id);
      expect(second.endedAt).toBeNull();
    });

    it('should reject an unknown routineId with VALIDATION', async () => {
      await expect(workoutsService.createWorkout(testUserId, 99999)).rejects.toMatchObject({
        code: 'VALIDATION',
        message: 'Rutina no válida',
      });
    });

    it('should reject another user custom routineId with VALIDATION', async () => {
      const [otherUser] = await db
        .insert(users)
        .values({
          name: 'Other Routines Owner',
          email: 'other-routine-owner@test.com',
          passwordHash: 'hash',
        })
        .returning();

      const [foreign] = await db
        .insert(routines)
        .values({
          slug: 'foreign-routine',
          name: 'Rutina ajena',
          kind: 'gym',
          restSeconds: 45,
          isSystem: false,
          userId: otherUser.id,
        })
        .returning();

      await expect(workoutsService.createWorkout(testUserId, foreign.id)).rejects.toMatchObject({
        code: 'VALIDATION',
        message: 'Rutina no válida',
      });
    });

    it('should reject concurrent creates so only one active workout remains', async () => {
      const results = await Promise.allSettled([
        workoutsService.createWorkout(testUserId),
        workoutsService.createWorkout(testUserId),
      ]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      if (rejected[0].status === 'rejected') {
        expect(rejected[0].reason).toMatchObject({ code: 'CONFLICT' });
      }

      const active = await workoutsService.getActiveWorkout(testUserId);
      expect(active).not.toBeNull();
    });
  });

  describe('listWorkouts', () => {
    it('should list workouts for a user excluding soft deleted', async () => {
      const finished = await workoutsService.createWorkout(testUserId);
      await workoutsService.updateWorkout(finished.id, testUserId, { endedAt: new Date() });

      const deleted = await workoutsService.createWorkout(testUserId);
      await workoutsService.deleteWorkout(deleted.id, testUserId);

      const list = await workoutsService.listWorkouts(testUserId);

      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(finished.id);
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
      expect(result.queue).toEqual({
        pendingExerciseIds: [],
        skippedExerciseIds: [],
        heldExerciseIds: [],
      });
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
