import { describe, it, expect, beforeEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { routines, scheduledRoutines, trainingPlans, users } from '@/lib/db/schema';
import {
  createTrainingPlan,
  resolveTodayScheduledRoutine,
} from '@/lib/services/training-plan';

describe('TrainingPlan adaptive service', () => {
  let userId: number;

  beforeEach(async () => {
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
    });
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
});
