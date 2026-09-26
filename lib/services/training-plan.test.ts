import { describe, it, expect, beforeEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  dailyCheckins,
  exercises,
  guidedTrainingPlanSaves,
  routineExercises,
  routines,
  scheduledRoutines,
  trainingPlans,
  users,
  workoutSets,
  workouts,
} from '@/lib/db/schema';
import {
  archiveTrainingPlan,
  createTrainingPlan,
  getTrainingPlanById,
  resolveTodayScheduledRoutine,
  updateTrainingPlan,
} from '@/lib/services/training-plan';
import { AppError } from '@/types/errors';

describe('TrainingPlan adaptive service', () => {
  let userId: number;

  beforeEach(async () => {
    await db.delete(dailyCheckins);
    await db.delete(workoutSets);
    await db.delete(workouts);
    await db.delete(guidedTrainingPlanSaves);
    await db.delete(scheduledRoutines);
    await db.delete(routineExercises);
    await db.delete(routines);
    await db.delete(trainingPlans);
    await db.delete(exercises);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({
        name: 'Training Plan User',
        email: `training-plan-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();

    userId = user.id;
  });

  async function createRoutine(name: string): Promise<number> {
    const [routine] = await db
      .insert(routines)
      .values({
        slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        name,
        kind: 'gym',
        restSeconds: 90,
        isSystem: false,
        userId,
      })
      .returning();

    return routine.id;
  }

  it('returns the scheduled routine for the current Córdoba weekday', async () => {
    const routineId = await createRoutine('Push');
    await createTrainingPlan({
      userId,
      name: 'Plan semanal',
      schedule: [{ dayOfWeek: 3, routineId }],
    });

    const result = await resolveTodayScheduledRoutine(
      userId,
      new Date('2026-09-16T15:00:00.000Z'),
    );

    expect(result).toEqual({
      kind: 'workout',
      localDate: '2026-09-16',
      dayOfWeek: 3,
      trainingPlanId: expect.any(Number),
      scheduledRoutineId: expect.any(Number),
      routineId,
      routineName: 'Push',
      planGoal: null,
      dayReason: 'Registrá tu check-in para que Atlas ajuste la sesión de hoy.',
      completion: { completed: 0, total: 0 },
    });
  });

  it('persists the plan goal and surfaces it as planGoal on the workout result', async () => {
    const routineId = await createRoutine('Push fuerza');
    await createTrainingPlan({
      userId,
      name: 'Plan semanal',
      goal: 'Hipertrofia',
      schedule: [{ dayOfWeek: 3, routineId }],
    });

    const result = await resolveTodayScheduledRoutine(
      userId,
      new Date('2026-09-16T15:00:00.000Z'),
    );

    expect(result).toMatchObject({ kind: 'workout', planGoal: 'Hipertrofia' });
  });

  it('does not surface a per-day note as dayReason on the workout result', async () => {
    const routineId = await createRoutine('Push nota');
    await createTrainingPlan({
      userId,
      name: 'Plan semanal',
      goal: 'Hipertrofia',
      schedule: [{ dayOfWeek: 3, routineId, note: 'Toca empuje pesado esta semana' }],
    });

    const result = await resolveTodayScheduledRoutine(
      userId,
      new Date('2026-09-16T15:00:00.000Z'),
    );

    expect(result).toMatchObject({
      kind: 'workout',
      dayReason: 'Registrá tu check-in para que Atlas ajuste la sesión de hoy.',
    });
  });

  it('builds dayReason from high energy and no ended workout yesterday', async () => {
    const routineId = await createRoutine('Push energía alta');
    await createTrainingPlan({
      userId,
      name: 'Plan semanal',
      goal: 'Fuerza',
      schedule: [{ dayOfWeek: 3, routineId, note: 'Nota privada del plan' }],
    });
    await db.insert(dailyCheckins).values({
      userId,
      localDate: '2026-09-16',
      mood: 5,
      energy: 'high',
    });

    const result = await resolveTodayScheduledRoutine(
      userId,
      new Date('2026-09-16T15:00:00.000Z'),
    );

    expect(result).toMatchObject({
      kind: 'workout',
      dayReason: 'Marcaste energía alta y ayer descansaste: buen día para la sesión prevista sin recortes.',
    });
  });

  it('does not claim yesterday rest when an ended workout exists on the previous Córdoba date', async () => {
    const routineId = await createRoutine('Push post descanso');
    await createTrainingPlan({
      userId,
      name: 'Plan semanal',
      goal: 'Fuerza',
      schedule: [{ dayOfWeek: 3, routineId }],
    });
    await db.insert(dailyCheckins).values({
      userId,
      localDate: '2026-09-16',
      mood: 5,
      energy: 'high',
    });
    await db.insert(workouts).values({
      userId,
      routineId,
      startedAt: new Date('2026-09-15T14:00:00.000Z'),
      endedAt: new Date('2026-09-15T15:00:00.000Z'),
    });

    const result = await resolveTodayScheduledRoutine(
      userId,
      new Date('2026-09-16T15:00:00.000Z'),
    );

    expect(result).toMatchObject({
      kind: 'workout',
      dayReason: 'Sesión de Fuerza prevista para hoy. Ajustá con Coach Atlas si tu día cambió.',
    });
  });

  it('rejects a per-day note longer than 140 characters with a typed validation error', async () => {
    const routineId = await createRoutine('Push nota límite');
    let caughtError: unknown;

    try {
      await createTrainingPlan({
        userId,
        name: 'Plan semanal',
        schedule: [{ dayOfWeek: 3, routineId, note: 'x'.repeat(141) }],
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(AppError);
    expect(caughtError).toMatchObject({ code: 'VALIDATION' });
  });

  it('rejects a goal longer than 60 characters with a typed validation error', async () => {
    const routineId = await createRoutine('Push límite');
    let caughtError: unknown;

    try {
      await createTrainingPlan({
        userId,
        name: 'Plan semanal',
        goal: 'x'.repeat(61),
        schedule: [{ dayOfWeek: 3, routineId }],
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(AppError);
    expect(caughtError).toMatchObject({ code: 'VALIDATION' });
  });

  it('returns rest_day when the active plan has no routine for today', async () => {
    const routineId = await createRoutine('Pull');
    await createTrainingPlan({
      userId,
      name: 'Plan semanal',
      schedule: [{ dayOfWeek: 1, routineId }],
    });

    const result = await resolveTodayScheduledRoutine(
      userId,
      new Date('2026-09-16T15:00:00.000Z'),
    );

    expect(result).toEqual({
      kind: 'rest_day',
      localDate: '2026-09-16',
      dayOfWeek: 3,
      trainingPlanId: expect.any(Number),
      planGoal: null,
    });
  });

  it('returns no_plan when the user has no active plan', async () => {
    const result = await resolveTodayScheduledRoutine(
      userId,
      new Date('2026-09-16T15:00:00.000Z'),
    );

    expect(result).toEqual({
      kind: 'no_plan',
      localDate: '2026-09-16',
      dayOfWeek: 3,
    });
  });

  it('returns routine_missing when the scheduled routine is soft-deleted', async () => {
    const routineId = await createRoutine('Legs');
    await createTrainingPlan({
      userId,
      name: 'Plan semanal',
      schedule: [{ dayOfWeek: 3, routineId }],
    });
    await db.update(routines).set({ deletedAt: new Date() }).where(eq(routines.id, routineId));

    const result = await resolveTodayScheduledRoutine(
      userId,
      new Date('2026-09-16T15:00:00.000Z'),
    );

    expect(result).toEqual({
      kind: 'routine_missing',
      localDate: '2026-09-16',
      dayOfWeek: 3,
      trainingPlanId: expect.any(Number),
      scheduledRoutineId: expect.any(Number),
      routineId,
      planGoal: null,
      dayReason: 'Registrá tu check-in para que Atlas ajuste la sesión de hoy.',
    });
  });

  it('uses Córdoba weekday across the UTC-to-Córdoba day boundary', async () => {
    const routineId = await createRoutine('Martes noche');
    await createTrainingPlan({
      userId,
      name: 'Plan semanal',
      schedule: [{ dayOfWeek: 2, routineId }],
    });

    const result = await resolveTodayScheduledRoutine(
      userId,
      new Date('2026-09-16T02:30:00.000Z'),
    );

    expect(result).toMatchObject({
      kind: 'workout',
      localDate: '2026-09-15',
      dayOfWeek: 2,
      routineId,
    });
  });

  it('rejects empty schedule with typed validation errors', async () => {
    const input = {
      userId,
      name: 'Plan sin días',
      schedule: [],
    };
    let caughtError: unknown;

    try {
      await createTrainingPlan(input);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(AppError);
    expect(caughtError).toMatchObject({
      code: 'VALIDATION',
      message: 'El plan debe tener al menos un día asignado',
    });
  });

  it('rejects invalid dayOfWeek values with typed validation errors', async () => {
    const routineId = await createRoutine('Invalid schedule');

    await expect(
      createTrainingPlan({
        userId,
        name: 'Plan inválido',
        schedule: [{ dayOfWeek: 7, routineId }],
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'Día de semana inválido',
    });
  });

  it('loads an owned training plan by id with its schedule', async () => {
    const routineId = await createRoutine('Load editable');
    const created = await createTrainingPlan({
      userId,
      name: 'Plan editable',
      goal: 'Fuerza',
      schedule: [{ dayOfWeek: 1, routineId, note: 'Empuje' }],
    });

    const loaded = await getTrainingPlanById(userId, created.plan.id);

    expect(loaded).toEqual({
      plan: expect.objectContaining({ id: created.plan.id, userId, name: 'Plan editable' }),
      schedule: [
        expect.objectContaining({
          trainingPlanId: created.plan.id,
          dayOfWeek: 1,
          routineId,
          note: 'Empuje',
        }),
      ],
      replacementStateHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it('returns NOT_FOUND when loading a missing, foreign, or soft-deleted plan', async () => {
    const routineId = await createRoutine('Foreign editable');
    const created = await createTrainingPlan({
      userId,
      name: 'Plan privado',
      schedule: [{ dayOfWeek: 1, routineId }],
    });
    const [otherUser] = await db
      .insert(users)
      .values({
        name: 'Other User',
        email: `training-plan-other-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();

    await expect(getTrainingPlanById(otherUser.id, created.plan.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Plan no encontrado',
    });
    await db.update(trainingPlans).set({ deletedAt: new Date() }).where(eq(trainingPlans.id, created.plan.id));
    await expect(getTrainingPlanById(userId, created.plan.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Plan no encontrado',
    });
    await expect(getTrainingPlanById(userId, 999_999)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Plan no encontrado',
    });
  });

  it('edits an active plan by creating a replacement and preserving the old schedule', async () => {
    const firstRoutineId = await createRoutine('Old day');
    const secondRoutineId = await createRoutine('New day');
    const created = await createTrainingPlan({
      userId,
      name: 'Plan anterior',
      goal: 'Fuerza',
      schedule: [{ dayOfWeek: 1, routineId: firstRoutineId, note: 'Viejo' }],
    });
    const source = await getTrainingPlanById(userId, created.plan.id);

    const updated = await updateTrainingPlan(userId, created.plan.id, {
      name: 'Plan nuevo',
      goal: 'Hipertrofia',
      schedule: [{ dayOfWeek: 3, routineId: secondRoutineId, note: 'Nuevo' }],
      mutationId: 'd03b2034-215e-4c9a-b377-e6d098808455',
      replacePlanId: created.plan.id,
      replacePlanUpdatedAt: source.plan.updatedAt.toISOString(),
      replacePlanStateHash: source.replacementStateHash,
    });

    expect(updated.plan).toMatchObject({ userId, name: 'Plan nuevo', goal: 'Hipertrofia', isActive: true });
    expect(updated.plan.id).not.toBe(created.plan.id);
    expect(updated.schedule).toEqual([
      expect.objectContaining({
        trainingPlanId: updated.plan.id,
        dayOfWeek: 3,
        routineId: secondRoutineId,
        note: 'Nuevo',
      }),
    ]);
    await expect(getTrainingPlanById(userId, created.plan.id)).resolves.toMatchObject({
      plan: { isActive: false },
      schedule: [expect.objectContaining({ dayOfWeek: 1, routineId: firstRoutineId, note: 'Viejo' })],
    });
  });

  it('clones same-Plan scoped routines and exercises when editing into a replacement Plan', async () => {
    const baseRoutineId = await createRoutine('Rutina de inicio');
    const source = await createTrainingPlan({
      userId,
      name: 'Plan con rutina generada',
      schedule: [{ dayOfWeek: 1, routineId: baseRoutineId }],
    });
    const [exercise] = await db
      .insert(exercises)
      .values({
        slug: `scoped-exercise-${Date.now()}`,
        name: 'Press de pecho',
        muscleGroup: 'Pecho',
        instructions: 'Empujar.',
        isSystem: true,
        userId: null,
      })
      .returning();
    const [scopedRoutine] = await db
      .insert(routines)
      .values({
        slug: `scoped-routine-${source.plan.id}`,
        name: 'Rutina anterior del plan',
        kind: 'gym',
        restSeconds: 120,
        isSystem: false,
        userId,
        trainingPlanId: source.plan.id,
      })
      .returning();
    await db.insert(routineExercises).values({
      routineId: scopedRoutine.id,
      exerciseId: exercise.id,
      sortOrder: 0,
      targetSets: 4,
      targetReps: 8,
    });
    const [assignment] = await db
      .select()
      .from(scheduledRoutines)
      .where(eq(scheduledRoutines.trainingPlanId, source.plan.id));
    if (!assignment) {
      throw new Error('The source plan assignment was not created for this test.');
    }
    await db
      .update(scheduledRoutines)
      .set({ routineId: scopedRoutine.id })
      .where(eq(scheduledRoutines.id, assignment.id));
    const snapshot = await getTrainingPlanById(userId, source.plan.id);

    const replacement = await createTrainingPlan({
      userId,
      name: 'Plan con rutina clonada',
      schedule: [{ dayOfWeek: 1, routineId: scopedRoutine.id }],
      mutationId: '9c547664-68c1-4728-943a-b06b53b6935d',
      replacePlanId: source.plan.id,
      replacePlanUpdatedAt: snapshot.plan.updatedAt.toISOString(),
      replacePlanStateHash: snapshot.replacementStateHash,
    });
    const replacementRoutineId = replacement.schedule[0]?.routineId;
    expect(replacementRoutineId).not.toBe(scopedRoutine.id);
    expect(
      await db.query.routines.findFirst({ where: eq(routines.id, scopedRoutine.id) }),
    ).toMatchObject({ trainingPlanId: source.plan.id, name: 'Rutina anterior del plan' });
    expect(
      await db.query.routines.findFirst({
        where: eq(routines.id, replacementRoutineId ?? -1),
      }),
    ).toMatchObject({ trainingPlanId: replacement.plan.id, name: 'Rutina anterior del plan' });
    expect(
      await db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, replacementRoutineId ?? -1)),
    ).toMatchObject([
      expect.objectContaining({
        exerciseId: exercise.id,
        targetSets: 4,
        targetReps: 8,
      }),
    ]);
  });

  it('rejects update with empty schedule, invalid weekday, missing plan, or foreign routine', async () => {
    const routineId = await createRoutine('Validation update');
    const created = await createTrainingPlan({
      userId,
      name: 'Plan base',
      schedule: [{ dayOfWeek: 1, routineId }],
    });
    const source = await getTrainingPlanById(userId, created.plan.id);
    const [otherUser] = await db
      .insert(users)
      .values({
        name: 'Routine Owner',
        email: `training-plan-routine-owner-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();
    const [foreignRoutine] = await db
      .insert(routines)
      .values({
        slug: `foreign-routine-${Date.now()}`,
        name: 'Foreign routine',
        kind: 'gym',
        restSeconds: 90,
        isSystem: false,
        userId: otherUser.id,
      })
      .returning();

    await expect(updateTrainingPlan(userId, created.plan.id, { name: 'Vacío', schedule: [] })).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'El plan debe tener al menos un día asignado',
    });
    await expect(
      updateTrainingPlan(userId, created.plan.id, {
        name: 'Inválido',
        schedule: [{ dayOfWeek: 8, routineId }],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION', message: 'Día de semana inválido' });
    await expect(
      updateTrainingPlan(userId, 999_999, {
        name: 'Missing',
        schedule: [{ dayOfWeek: 1, routineId }],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Plan no encontrado' });
    await expect(
      updateTrainingPlan(userId, created.plan.id, {
        name: 'Ajena',
        schedule: [{ dayOfWeek: 2, routineId: foreignRoutine.id }],
        mutationId: '0d98a4b6-e64d-49f5-9590-c30595a7f44e',
        replacePlanId: created.plan.id,
        replacePlanUpdatedAt: source.plan.updatedAt.toISOString(),
        replacePlanStateHash: source.replacementStateHash,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION', message: 'Rutina no disponible' });
  });

  it('does not replace an active plan without explicit confirmation', async () => {
    const activeRoutineId = await createRoutine('Plan activo');
    const replacementRoutineId = await createRoutine('Plan propuesto');
    const active = await createTrainingPlan({
      userId,
      name: 'Plan actual',
      schedule: [{ dayOfWeek: 1, routineId: activeRoutineId }],
    });

    await expect(
      createTrainingPlan({
        userId,
        name: 'Plan nuevo',
        schedule: [{ dayOfWeek: 3, routineId: replacementRoutineId }],
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await expect(getTrainingPlanById(userId, active.plan.id)).resolves.toMatchObject({
      plan: { isActive: true, deletedAt: null },
      schedule: [expect.objectContaining({ dayOfWeek: 1, routineId: activeRoutineId })],
    });
    expect(await db.select().from(trainingPlans).where(eq(trainingPlans.userId, userId))).toHaveLength(1);
  });

  it('replays an identical confirmed replacement and conflicts when its mutation key is reused', async () => {
    const oldRoutineId = await createRoutine('Rutina histórica');
    const newRoutineId = await createRoutine('Rutina nueva');
    const source = await createTrainingPlan({
      userId,
      name: 'Plan vigente',
      schedule: [{ dayOfWeek: 1, routineId: oldRoutineId, note: 'Historial intacto' }],
    });
    const snapshot = await getTrainingPlanById(userId, source.plan.id);
    const input = {
      userId,
      name: 'Versión confirmada',
      schedule: [{ dayOfWeek: 3, routineId: newRoutineId }],
      mutationId: '227de0ee-9e51-4b33-af91-8a8b4f8df680',
      replacePlanId: source.plan.id,
      replacePlanUpdatedAt: snapshot.plan.updatedAt.toISOString(),
      replacePlanStateHash: snapshot.replacementStateHash,
    };

    const created = await createTrainingPlan(input);
    const replay = await createTrainingPlan(input);
    expect(replay).toEqual(created);
    await expect(createTrainingPlan({ ...input, name: 'Payload diferente' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(getTrainingPlanById(userId, source.plan.id)).resolves.toMatchObject({
      plan: { isActive: false, deletedAt: null },
      schedule: [
        expect.objectContaining({
          dayOfWeek: 1,
          routineId: oldRoutineId,
          note: 'Historial intacto',
        }),
      ],
    });
    expect(await db.select().from(trainingPlans).where(eq(trainingPlans.userId, userId))).toHaveLength(2);
  });

  it('serializes concurrent submissions with the same owner-scoped mutation id', async () => {
    const routineId = await createRoutine('Plan concurrente');
    const input = {
      userId,
      name: 'Plan idempotente',
      schedule: [{ dayOfWeek: 4, routineId }],
      mutationId: '7276c690-f1e9-4666-8840-30c389b6c435',
    };
    const [first, second] = await Promise.all([
      createTrainingPlan(input),
      createTrainingPlan(input),
    ]);

    expect(second).toEqual(first);
    expect(await db.select().from(trainingPlans).where(eq(trainingPlans.userId, userId))).toHaveLength(1);
    expect(await db.select().from(guidedTrainingPlanSaves)).toHaveLength(1);
  });

  it('rolls back a confirmed replacement when assignment persistence fails', async () => {
    const oldRoutineId = await createRoutine('Rutina a preservar');
    const newRoutineId = await createRoutine('Rutina que falla');
    const source = await createTrainingPlan({
      userId,
      name: 'Plan activo',
      schedule: [{ dayOfWeek: 2, routineId: oldRoutineId }],
    });
    const snapshot = await getTrainingPlanById(userId, source.plan.id);
    await db.$client.execute({
      sql: `CREATE TRIGGER reject_plan_schedule
        BEFORE INSERT ON scheduled_routines
        WHEN NEW.training_plan_id != ${source.plan.id}
        BEGIN
          SELECT RAISE(ABORT, 'forced plan schedule failure');
        END`,
      args: [],
    });
    try {
      await expect(
        createTrainingPlan({
          userId,
          name: 'No debe activarse',
          schedule: [{ dayOfWeek: 4, routineId: newRoutineId }],
          mutationId: '3773ec5d-e8e4-49d5-86fd-152bd2ce0503',
          replacePlanId: source.plan.id,
          replacePlanUpdatedAt: snapshot.plan.updatedAt.toISOString(),
          replacePlanStateHash: snapshot.replacementStateHash,
        }),
      ).rejects.toThrow();
    } finally {
      await db.$client.execute('DROP TRIGGER reject_plan_schedule');
    }

    await expect(getTrainingPlanById(userId, source.plan.id)).resolves.toMatchObject({
      plan: { isActive: true, deletedAt: null },
      schedule: [expect.objectContaining({ dayOfWeek: 2, routineId: oldRoutineId })],
    });
    expect(await db.select().from(trainingPlans).where(eq(trainingPlans.userId, userId))).toHaveLength(1);
    expect(await db.select().from(scheduledRoutines)).toHaveLength(1);
    expect(await db.select().from(guidedTrainingPlanSaves)).toHaveLength(0);
  });

  it('archives an active plan without deleting its schedule or routines and replays by mutation id', async () => {
    const activeRoutineId = await createRoutine('Plan para archivar');
    const active = await createTrainingPlan({
      userId,
      name: 'Plan histórico',
      schedule: [{ dayOfWeek: 2, routineId: activeRoutineId }],
    });

    const archiveInput = {
      mutationId: 'd80bc234-897f-4d48-97f9-e5d2c521739d',
      expectedPlanUpdatedAt: active.plan.updatedAt.toISOString(),
    };
    const result = await archiveTrainingPlan(userId, active.plan.id, archiveInput);
    const replay = await archiveTrainingPlan(userId, active.plan.id, archiveInput);

    expect(replay).toEqual(result);
    expect(result.plan).toMatchObject({ isActive: false, deletedAt: null });
    expect(result.schedule).toEqual([
      expect.objectContaining({ trainingPlanId: active.plan.id, routineId: activeRoutineId }),
    ]);
    expect(await db.query.routines.findFirst({ where: eq(routines.id, activeRoutineId) })).toBeDefined();
  });

  it('rejects stale or foreign archive confirmations without changing the plan', async () => {
    const routineId = await createRoutine('No archivar');
    const active = await createTrainingPlan({
      userId,
      name: 'Plan protegido',
      schedule: [{ dayOfWeek: 2, routineId }],
    });
    const [otherUser] = await db
      .insert(users)
      .values({
        name: 'Owner distinto',
        email: `plan-archive-owner-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();
    const confirmation = {
      mutationId: '67c844b3-a7ed-46d9-8b6f-0f543991f391',
      expectedPlanUpdatedAt: active.plan.updatedAt.toISOString(),
    };

    await expect(archiveTrainingPlan(otherUser.id, active.plan.id, confirmation)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await db
      .update(trainingPlans)
      .set({ updatedAt: new Date(active.plan.updatedAt.getTime() + 1000) })
      .where(eq(trainingPlans.id, active.plan.id));
    await expect(
      archiveTrainingPlan(userId, active.plan.id, {
        mutationId: 'f95b661c-c75f-40a3-8142-d6e234c47339',
        expectedPlanUpdatedAt: active.plan.updatedAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(getTrainingPlanById(userId, active.plan.id)).resolves.toMatchObject({
      plan: { isActive: true, deletedAt: null },
      schedule: [expect.objectContaining({ routineId })],
    });
  });
});
