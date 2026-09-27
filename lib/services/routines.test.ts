/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { db } from '@/lib/db/client';
import {
  guidedTrainingPlanSaves,
  sessions,
  botMessages,
  dailyCheckins,
  exercises,
  routineExercises,
  routines,
  scheduledRoutines,
  streakNudges,
  telegramLinkCodes,
  trainingPlans,
  users,
  userStreaks,
  workouts,
  workoutSets,
} from '@/lib/db/schema';
import {
  createRoutine,
  deleteRoutine,
  getRoutineById,
  listRoutines,
  updateRoutine,
} from '@/lib/services/routines';
import { createWorkout } from '@/lib/services/workouts';
import { AppError } from '@/types/errors';

async function wipe() {
  await db.delete(workoutSets);
  await db.delete(workouts);
  await db.delete(guidedTrainingPlanSaves);
  await db.delete(scheduledRoutines);
  await db.delete(routineExercises);
  await db.delete(routines);
  await db.delete(trainingPlans);
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
    const list = await listRoutines(userId);
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
    await expect(getRoutineById(99999, userId)).rejects.toBeInstanceOf(AppError);
  });

  it('createWorkout stores routineId when the routine exists', async () => {
    const list = await listRoutines(userId);
    const workout = await createWorkout(userId, list[0].id);
    expect(workout.routineId).toBe(list[0].id);
    expect(workout.endedAt).toBeNull();
  });

  it('hides another user custom routines from list and get (404 ajeno)', async () => {
    const [other] = await db
      .insert(users)
      .values({ name: 'Other Routines', email: 'other-routines@test.com', passwordHash: 'hash' })
      .returning();

    const [foreign] = await db
      .insert(routines)
      .values({
        slug: 'foreign-custom',
        name: 'Rutina ajena',
        kind: 'home',
        restSeconds: 30,
        isSystem: false,
        userId: other.id,
      })
      .returning();

    await db.insert(routineExercises).values({
      routineId: foreign.id,
      exerciseId: benchId,
      sortOrder: 1,
      targetSets: 1,
      targetReps: 5,
    });

    const [own] = await db
      .insert(routines)
      .values({
        slug: 'own-custom',
        name: 'Rutina propia',
        kind: 'home',
        restSeconds: 30,
        isSystem: false,
        userId,
      })
      .returning();

    const list = await listRoutines(userId);
    const slugs = list.map((item) => item.slug).sort();
    expect(slugs).toEqual(['full-body-expres', 'own-custom']);
    expect(list.every((item) => !('userId' in item))).toBe(true);

    const loaded = await getRoutineById(own.id, userId);
    expect(loaded.slug).toBe('own-custom');

    await expect(getRoutineById(foreign.id, userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Rutina no encontrada',
    });
  });

  it('rejects createWorkout with a foreign routineId as VALIDATION', async () => {
    const [other] = await db
      .insert(users)
      .values({ name: 'Other Workout', email: 'other-wo-routines@test.com', passwordHash: 'hash' })
      .returning();
    const [foreign] = await db
      .insert(routines)
      .values({
        slug: 'steal-me',
        name: 'Ajena',
        kind: 'gym',
        restSeconds: 60,
        isSystem: false,
        userId: other.id,
      })
      .returning();

    await expect(createWorkout(userId, foreign.id)).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'Rutina no válida',
    });
  });

  it('creates, updates and soft-deletes own custom routines', async () => {
    const created = await createRoutine(userId, {
      name: 'Casa custom',
      description: 'Mía',
      kind: 'home',
      restSeconds: 40,
      exercises: [
        { exerciseId: benchId, sortOrder: 0, targetSets: 3, targetReps: 10 },
        { exerciseId: squatId, sortOrder: 1, targetSets: 4, targetReps: 8 },
      ],
    });

    expect(created.isSystem).toBe(false);
    expect(created.slug).toBe(`casa-custom-u${userId}`);
    expect(created).not.toHaveProperty('userId');
    expect(created.exercises.map((item) => item.exerciseName)).toEqual(['Press Banca', 'Sentadilla']);

    const listed = await listRoutines(userId);
    expect(listed.map((item) => item.slug).sort()).toEqual(['casa-custom-u' + userId, 'full-body-expres'].sort());

    const updated = await updateRoutine(created.id, userId, {
      name: 'Casa custom 2',
      exercises: [{ exerciseId: squatId, sortOrder: 0, targetSets: 5, targetReps: 5 }],
    });
    expect(updated.name).toBe('Casa custom 2');
    expect(updated.exercises).toHaveLength(1);
    expect(updated.exercises[0].exerciseName).toBe('Sentadilla');

    await deleteRoutine(created.id, userId);
    await expect(getRoutineById(created.id, userId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const afterDelete = await listRoutines(userId);
    expect(afterDelete.map((item) => item.id)).not.toContain(created.id);
  });

  it('creates manual routines as library routines with no Plan provenance', async () => {
    const created = await createRoutine(userId, {
      name: 'Biblioteca manual',
      kind: 'gym',
      exercises: [{ exerciseId: squatId, sortOrder: 0, targetSets: 3, targetReps: 8 }],
    });

    const scope = await db.$client.execute({
      sql: 'SELECT training_plan_id FROM routines WHERE id = ?',
      args: [created.id],
    });
    expect(scope.rows[0]?.training_plan_id).toBeNull();
    expect((await listRoutines(userId)).map(({ id }) => id)).toContain(created.id);
  });

  it('keeps Plan-scoped routines out of the library and exposes them only in their owned Plan context', async () => {
    const [plan] = await db
      .insert(trainingPlans)
      .values({ userId, name: 'Plan con rutina', isActive: true })
      .returning();
    const [otherPlan] = await db
      .insert(trainingPlans)
      .values({ userId, name: 'Otro plan histórico', isActive: false })
      .returning();
    const [scopedRoutine] = await db
      .insert(routines)
      .values({
        slug: `plan-routine-${plan.id}`,
        name: 'Rutina del plan',
        kind: 'gym',
        restSeconds: 90,
        isSystem: false,
        userId,
        trainingPlanId: plan.id,
      })
      .returning();
    await db.insert(routineExercises).values({
      routineId: scopedRoutine.id,
      exerciseId: benchId,
      sortOrder: 0,
      targetSets: 3,
      targetReps: 8,
    });

    expect((await listRoutines(userId)).map(({ id }) => id)).not.toContain(scopedRoutine.id);
    expect((await listRoutines(userId, plan.id)).map(({ id }) => id)).toContain(scopedRoutine.id);
    await expect(getRoutineById(scopedRoutine.id, userId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(getRoutineById(scopedRoutine.id, userId, otherPlan.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(getRoutineById(scopedRoutine.id, userId, plan.id)).resolves.toMatchObject({
      id: scopedRoutine.id,
      name: 'Rutina del plan',
    });
    await expect(updateRoutine(scopedRoutine.id, userId, { name: 'Cambiar historia' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(deleteRoutine(scopedRoutine.id, userId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(createWorkout(userId, scopedRoutine.id)).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'La rutina debe iniciarse desde su plan',
    });
    await expect(
      createWorkout(userId, scopedRoutine.id, { trainingPlanId: plan.id }),
    ).resolves.toMatchObject({ routineId: scopedRoutine.id });
  });

  it('forbids mutating system routines and 404s foreign mutate', async () => {
    const system = (await listRoutines(userId)).find((item) => item.isSystem);
    expect(system).toBeDefined();
    await expect(updateRoutine(system!.id, userId, { name: 'Hack' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'No puedes modificar una rutina del sistema',
    });
    await expect(deleteRoutine(system!.id, userId)).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const [other] = await db
      .insert(users)
      .values({ name: 'Other Mutate', email: 'other-mutate-routines@test.com', passwordHash: 'hash' })
      .returning();
    const [foreign] = await db
      .insert(routines)
      .values({
        slug: 'foreign-mutate-svc',
        name: 'Ajena svc',
        kind: 'gym',
        restSeconds: 30,
        isSystem: false,
        userId: other.id,
      })
      .returning();

    await expect(updateRoutine(foreign.id, userId, { name: 'Hack' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(deleteRoutine(foreign.id, userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects empty exercise lists and inaccessible exercise ids', async () => {
    await expect(
      createRoutine(userId, {
        name: 'Vacia',
        kind: 'gym',
        exercises: [],
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'La rutina debe incluir al menos un ejercicio',
    });

    await expect(
      createRoutine(userId, {
        name: 'Invalida',
        kind: 'gym',
        exercises: [{ exerciseId: 999999, sortOrder: 0, targetSets: 3, targetReps: 10 }],
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Ejercicio no encontrado',
    });

    const [other] = await db
      .insert(users)
      .values({ name: 'Other Ex', email: 'other-ex-routines@test.com', passwordHash: 'hash' })
      .returning();
    const [foreignEx] = await db
      .insert(exercises)
      .values({
        slug: 'foreign-ex-routine',
        name: 'Ajeno',
        muscleGroup: 'Biceps',
        instructions: 'x',
        isSystem: false,
        userId: other.id,
      })
      .returning();

    await expect(
      createRoutine(userId, {
        name: 'Robo',
        kind: 'gym',
        exercises: [{ exerciseId: foreignEx.id, sortOrder: 0, targetSets: 3, targetReps: 10 }],
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Ejercicio no encontrado',
    });

    await expect(
      createRoutine(userId, {
        name: 'Orden repetido',
        kind: 'gym',
        exercises: [
          { exerciseId: benchId, sortOrder: 1, targetSets: 3, targetReps: 10 },
          { exerciseId: squatId, sortOrder: 1, targetSets: 3, targetReps: 8 },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'El orden de los ejercicios no puede repetirse',
    });
  });
});
