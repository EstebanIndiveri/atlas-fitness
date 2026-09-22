import { describe, it, expect, beforeEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { dailyCheckins, routines, scheduledRoutines, trainingPlans, users, workouts } from '@/lib/db/schema';
import {
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
    await db.delete(workouts);
    await db.delete(scheduledRoutines);
    await db.delete(trainingPlans);
    await db.delete(routines);
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

  it('updates an owned training plan metadata and replaces the schedule atomically', async () => {
    const firstRoutineId = await createRoutine('Old day');
    const secondRoutineId = await createRoutine('New day');
    const created = await createTrainingPlan({
      userId,
      name: 'Plan anterior',
      goal: 'Fuerza',
      schedule: [{ dayOfWeek: 1, routineId: firstRoutineId, note: 'Viejo' }],
    });

    const updated = await updateTrainingPlan(userId, created.plan.id, {
      name: 'Plan nuevo',
      goal: 'Hipertrofia',
      schedule: [{ dayOfWeek: 3, routineId: secondRoutineId, note: 'Nuevo' }],
    });

    expect(updated.plan).toMatchObject({ id: created.plan.id, userId, name: 'Plan nuevo', goal: 'Hipertrofia' });
    expect(updated.schedule).toEqual([
      expect.objectContaining({
        trainingPlanId: created.plan.id,
        dayOfWeek: 3,
        routineId: secondRoutineId,
        note: 'Nuevo',
      }),
    ]);
    await expect(getTrainingPlanById(userId, created.plan.id)).resolves.toMatchObject({
      schedule: [expect.objectContaining({ dayOfWeek: 3, routineId: secondRoutineId })],
    });
  });

  it('rejects update with empty schedule, invalid weekday, missing plan, or foreign routine', async () => {
    const routineId = await createRoutine('Validation update');
    const created = await createTrainingPlan({
      userId,
      name: 'Plan base',
      schedule: [{ dayOfWeek: 1, routineId }],
    });
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
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION', message: 'Rutina no disponible' });
  });
});
