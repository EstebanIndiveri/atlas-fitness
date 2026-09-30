import { describe, it, expect, beforeEach } from '@jest/globals';
import * as workoutSetsService from './workout-sets';
import * as workoutsService from './workouts';
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

/** A complete v1 external working tuple, the common happy path. */
function externalSemantics() {
  return {
    semanticCaptureVersion: 1,
    loadMode: 'external',
    amountBasis: 'total',
    side: 'bilateral',
    setPurpose: 'working',
    repCountBasis: null,
  };
}

async function createWorkout(userId: number) {
  return workoutsService.createWorkout(userId);
}

/** Inserts a legacy (all-null semantics) row directly, as a pre-v0.12 client would have. */
async function insertLegacySet(workoutId: number, exerciseId: number, setIndex = 1) {
  const [set] = await db
    .insert(workoutSets)
    .values({ workoutId, exerciseId, setIndex, reps: 10, weightKg: '100', completed: true })
    .returning();
  return set;
}

describe('Workout Sets Service', () => {
  let testUserId: number;
  let testExerciseId: number;

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
    it('should create a new workout set with valid data and a v1 tuple', async () => {
      const workout = await createWorkout(testUserId);

      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
        ...externalSemantics(),
      });

      expect(set.id).toBeDefined();
      expect(set.workoutId).toBe(workout.id);
      expect(set.exerciseId).toBe(testExerciseId);
      expect(set.setIndex).toBe(1);
      expect(set.reps).toBe(10);
      expect(set.weightKg).toBe('100');
      expect(set.semanticCaptureVersion).toBe(1);
      expect(set.loadMode).toBe('external');
      expect(set.amountBasis).toBe('total');
      expect(set.side).toBe('bilateral');
      expect(set.setPurpose).toBe('working');
      expect(set.repCountBasis).toBeNull();
    });

    it('rejects a non-canonical external amount (v1 writes are normalized)', async () => {
      const workout = await createWorkout(testUserId);
      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 10,
          weightKg: '080.50',
          ...externalSemantics(),
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('accepts bodyweight with the canonical zero sentinel', async () => {
      const workout = await createWorkout(testUserId);
      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 8,
        weightKg: '0.00',
        semanticCaptureVersion: 1,
        loadMode: 'bodyweight',
        amountBasis: null,
        side: 'bilateral',
        setPurpose: 'working',
        repCountBasis: null,
      });
      expect(set.weightKg).toBe('0');
      expect(set.loadMode).toBe('bodyweight');
      expect(set.amountBasis).toBeNull();
    });

    it('rejects bodyweight with a positive amount', async () => {
      const workout = await createWorkout(testUserId);
      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 8,
          weightKg: '10',
          semanticCaptureVersion: 1,
          loadMode: 'bodyweight',
          amountBasis: null,
          side: 'bilateral',
          setPurpose: 'working',
          repCountBasis: null,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('rejects an external set whose amount is zero', async () => {
      const workout = await createWorkout(testUserId);
      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 10,
          weightKg: '0',
          ...externalSemantics(),
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('records assisted sets with a positive assistance magnitude as not comparable', async () => {
      const workout = await createWorkout(testUserId);
      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 8,
        weightKg: '20',
        semanticCaptureVersion: 1,
        loadMode: 'assisted',
        amountBasis: 'total',
        side: 'bilateral',
        setPurpose: 'working',
        repCountBasis: null,
      });
      expect(set.loadMode).toBe('assisted');
    });

    it('rejects a left set declared per_side', async () => {
      const workout = await createWorkout(testUserId);
      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 10,
          weightKg: '20',
          semanticCaptureVersion: 1,
          loadMode: 'external',
          amountBasis: 'per_side',
          side: 'left',
          setPurpose: 'working',
          repCountBasis: null,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('rejects alternating without a rep-count basis', async () => {
      const workout = await createWorkout(testUserId);
      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 10,
          weightKg: '40',
          semanticCaptureVersion: 1,
          loadMode: 'external',
          amountBasis: 'total',
          side: 'alternating',
          setPurpose: 'working',
          repCountBasis: null,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('records alternating with a rep-count basis (not comparable for the MVP metric)', async () => {
      const workout = await createWorkout(testUserId);
      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '40',
        semanticCaptureVersion: 1,
        loadMode: 'external',
        amountBasis: 'total',
        side: 'alternating',
        setPurpose: 'working',
        repCountBasis: 'per_side',
      });
      expect(set.side).toBe('alternating');
      expect(set.repCountBasis).toBe('per_side');
    });

    it('records a warmup set', async () => {
      const workout = await createWorkout(testUserId);
      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '40',
        ...externalSemantics(),
        setPurpose: 'warmup',
      });
      expect(set.setPurpose).toBe('warmup');
    });

    it('rejects a new set with a missing semantic tuple (outdated client)', async () => {
      const workout = await createWorkout(testUserId);
      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 10,
          weightKg: '100',
          semanticCaptureVersion: null,
          loadMode: null,
          amountBasis: null,
          side: null,
          setPurpose: null,
          repCountBasis: null,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('rejects a partial semantic tuple', async () => {
      const workout = await createWorkout(testUserId);
      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 10,
          weightKg: '100',
          semanticCaptureVersion: 1,
          loadMode: 'external',
          amountBasis: 'total',
          side: null,
          setPurpose: null,
          repCountBasis: null,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('rejects an unsupported capture version', async () => {
      const workout = await createWorkout(testUserId);
      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 10,
          weightKg: '100',
          semanticCaptureVersion: 2,
          loadMode: 'external',
          amountBasis: 'total',
          side: 'bilateral',
          setPurpose: 'working',
          repCountBasis: null,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('should throw CONFLICT for duplicate set_index (TOCTOU test)', async () => {
      const workout = await createWorkout(testUserId);

      await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
        ...externalSemantics(),
      });

      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 12,
          weightKg: '105',
          ...externalSemantics(),
        })
      ).rejects.toThrow('Ya existe una serie con este índice en el entrenamiento');
    });

    it('should validate reps is positive', async () => {
      const workout = await createWorkout(testUserId);

      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 0,
          weightKg: '100',
          ...externalSemantics(),
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
          ...externalSemantics(),
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
          ...externalSemantics(),
        })
      ).rejects.toThrow('No tienes permiso para modificar este entrenamiento');
    });

    it('should throw NOT_FOUND if exercise belongs to another user', async () => {
      const [otherUser] = await db
        .insert(users)
        .values({
          name: 'Other Exercise Owner',
          email: 'other-ex-owner@test.com',
          passwordHash: 'hash',
        })
        .returning();

      const [foreignExercise] = await db
        .insert(exercises)
        .values({
          slug: 'foreign-exercise',
          name: 'Ejercicio ajeno',
          muscleGroup: 'Test',
          instructions: 'x',
          isSystem: false,
          userId: otherUser.id,
        })
        .returning();

      const workout = await createWorkout(testUserId);

      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: foreignExercise.id,
          setIndex: 1,
          reps: 10,
          weightKg: '100',
          ...externalSemantics(),
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Ejercicio no encontrado',
      });
    });

    it('should throw VALIDATION if workout is already ended', async () => {
      const workout = await createWorkout(testUserId);
      await workoutsService.updateWorkout(workout.id, testUserId, { endedAt: new Date() });

      await expect(
        workoutSetsService.createWorkoutSet({
          workoutId: workout.id,
          userId: testUserId,
          exerciseId: testExerciseId,
          setIndex: 1,
          reps: 10,
          weightKg: '100',
          ...externalSemantics(),
        })
      ).rejects.toThrow('No puedes agregar series a un entrenamiento finalizado');
    });
  });

  describe('updateWorkoutSet', () => {
    it('should update a v1 workout set atomically', async () => {
      const workout = await createWorkout(testUserId);
      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
        ...externalSemantics(),
      });

      const updated = await workoutSetsService.updateWorkoutSet({
        setId: set.id,
        userId: testUserId,
        reps: 12,
        weightKg: '105',
      });

      expect(updated.reps).toBe(12);
      expect(updated.weightKg).toBe('105');
      expect(updated.loadMode).toBe('external');
    });

    it('rejects a mode change that leaves an invalid final tuple', async () => {
      const workout = await createWorkout(testUserId);
      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
        ...externalSemantics(),
      });

      await expect(
        workoutSetsService.updateWorkoutSet({
          setId: set.id,
          userId: testUserId,
          loadMode: 'bodyweight',
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('accepts a mode change when the whole resulting tuple is valid', async () => {
      const workout = await createWorkout(testUserId);
      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
        ...externalSemantics(),
      });

      const updated = await workoutSetsService.updateWorkoutSet({
        setId: set.id,
        userId: testUserId,
        loadMode: 'bodyweight',
        amountBasis: null,
        weightKg: '0',
      });

      expect(updated.loadMode).toBe('bodyweight');
      expect(updated.weightKg).toBe('0');
      expect(updated.amountBasis).toBeNull();
    });

    it('preserves all six NULL semantic columns on a legacy nonsemantic edit', async () => {
      const workout = await createWorkout(testUserId);
      const legacy = await insertLegacySet(workout.id, testExerciseId);

      const updated = await workoutSetsService.updateWorkoutSet({
        setId: legacy.id,
        userId: testUserId,
        reps: 12,
      });

      expect(updated.reps).toBe(12);
      expect(updated.semanticCaptureVersion).toBeNull();
      expect(updated.loadMode).toBeNull();
      expect(updated.amountBasis).toBeNull();
      expect(updated.side).toBeNull();
      expect(updated.setPurpose).toBeNull();
      expect(updated.repCountBasis).toBeNull();
    });

    it('rejects a legacy semantic upgrade attempt', async () => {
      const workout = await createWorkout(testUserId);
      const legacy = await insertLegacySet(workout.id, testExerciseId);

      await expect(
        workoutSetsService.updateWorkoutSet({
          setId: legacy.id,
          userId: testUserId,
          loadMode: 'external',
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });

      const after = await db.query.workoutSets.findFirst({ where: (t, { eq }) => eq(t.id, legacy.id) });
      expect(after?.semanticCaptureVersion).toBeNull();
      expect(after?.loadMode).toBeNull();
    });

    it('should throw VALIDATION when updating a set on a finished workout', async () => {
      const workout = await createWorkout(testUserId);
      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
        ...externalSemantics(),
      });
      await workoutsService.updateWorkout(workout.id, testUserId, { endedAt: new Date() });

      await expect(
        workoutSetsService.updateWorkoutSet({
          setId: set.id,
          userId: testUserId,
          weightKg: '20',
        }),
      ).rejects.toMatchObject({
        code: 'VALIDATION',
        message: 'No puedes modificar series de un entrenamiento finalizado',
      });
    });

    it('should throw NOT_FOUND when updating exerciseId to a foreign custom', async () => {
      const workout = await createWorkout(testUserId);
      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
        ...externalSemantics(),
      });

      const [otherUser] = await db
        .insert(users)
        .values({
          name: 'Other Exercise Owner 2',
          email: 'other-ex-owner2@test.com',
          passwordHash: 'hash',
        })
        .returning();
      const [foreignExercise] = await db
        .insert(exercises)
        .values({
          slug: 'foreign-exercise-update',
          name: 'Ajeno update',
          muscleGroup: 'Test',
          instructions: 'x',
          isSystem: false,
          userId: otherUser.id,
        })
        .returning();

      await expect(
        workoutSetsService.updateWorkoutSet({
          setId: set.id,
          userId: testUserId,
          exerciseId: foreignExercise.id,
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Ejercicio no encontrado',
      });
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
        ...externalSemantics(),
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
      const workout = await createWorkout(testUserId);
      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
        ...externalSemantics(),
      });

      await workoutSetsService.deleteWorkoutSet(set.id, testUserId);

      const sets = await workoutSetsService.listWorkoutSets(workout.id, testUserId);
      expect(sets).toHaveLength(0);
    });

    it('should throw VALIDATION when deleting a set on a finished workout', async () => {
      const workout = await createWorkout(testUserId);
      const set = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
        ...externalSemantics(),
      });
      await workoutsService.updateWorkout(workout.id, testUserId, { endedAt: new Date() });

      await expect(workoutSetsService.deleteWorkoutSet(set.id, testUserId)).rejects.toMatchObject({
        code: 'VALIDATION',
        message: 'No puedes eliminar series de un entrenamiento finalizado',
      });

      const sets = await workoutSetsService.listWorkoutSets(workout.id, testUserId);
      expect(sets).toHaveLength(1);
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
        ...externalSemantics(),
      });

      await expect(workoutSetsService.deleteWorkoutSet(set.id, testUserId)).rejects.toThrow(
        'No tienes permiso para eliminar esta serie'
      );
    });
  });

  describe('listWorkoutSets', () => {
    it('should list sets for a workout excluding soft deleted', async () => {
      const workout = await createWorkout(testUserId);

      const set1 = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 1,
        reps: 10,
        weightKg: '100',
        ...externalSemantics(),
      });

      const set2 = await workoutSetsService.createWorkoutSet({
        workoutId: workout.id,
        userId: testUserId,
        exerciseId: testExerciseId,
        setIndex: 2,
        reps: 10,
        weightKg: '100',
        ...externalSemantics(),
      });

      await workoutSetsService.deleteWorkoutSet(set2.id, testUserId);

      const sets = await workoutSetsService.listWorkoutSets(workout.id, testUserId);

      expect(sets).toHaveLength(1);
      expect(sets[0].id).toBe(set1.id);
    });
  });
});
