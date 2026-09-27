import { beforeEach, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { routines, scheduledRoutines, trainingPlans, users } from '@/lib/db/schema';
import { archiveTrainingPlan, createTrainingPlan } from '@/lib/services/training-plan';
import { getTrainingPlanHub } from '@/lib/services/training-plan-hub';

describe('training plan hub read model', () => {
  let userId: number;

  beforeEach(async () => {
    const [user] = await db
      .insert(users)
      .values({
        name: 'Plan Hub User',
        email: `plan-hub-${Date.now()}-${Math.random()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();
    userId = user.id;
  });

  async function createRoutine(name: string): Promise<number> {
    const [routine] = await db
      .insert(routines)
      .values({
        slug: `plan-hub-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}`,
        name,
        description: `Foco de ${name}`,
        kind: 'gym',
        restSeconds: 90,
        isSystem: false,
        userId,
      })
      .returning();

    return routine.id;
  }

  it('returns the real plan and all seven days Monday-first with named routine assignments and rest days', async () => {
    const pushId = await createRoutine('Empuje');
    const pullId = await createRoutine('Tirón');
    const created = await createTrainingPlan({
      userId,
      name: 'Semana de fuerza',
      goal: 'Fuerza máxima',
      schedule: [
        { dayOfWeek: 1, routineId: pushId, note: 'Técnica de empuje' },
        { dayOfWeek: 5, routineId: pullId },
      ],
    });

    const hub = await getTrainingPlanHub(userId, created.plan.id);

    expect(hub.plan).toMatchObject({
      id: created.plan.id,
      name: 'Semana de fuerza',
      goal: 'Fuerza máxima',
      isActive: true,
      updatedAt: created.plan.updatedAt.toISOString(),
    });
    expect(hub.days).toHaveLength(7);
    expect(hub.days.map((day) => day.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(hub.days[0]).toEqual({
      dayOfWeek: 1,
      assignment: {
        kind: 'routine',
        routineId: pushId,
        routineName: 'Empuje',
        routineDescription: 'Foco de Empuje',
        routineKind: 'gym',
        focus: 'Técnica de empuje',
      },
    });
    expect(hub.days[1]).toEqual({ dayOfWeek: 2, assignment: { kind: 'rest' } });
    expect(hub.days[4]?.assignment).toMatchObject({ kind: 'routine', routineName: 'Tirón', focus: null });
    expect(hub.days[5]).toEqual({ dayOfWeek: 6, assignment: { kind: 'rest' } });
    expect(hub.days[6]).toEqual({ dayOfWeek: 0, assignment: { kind: 'rest' } });
  });

  it('returns actual inactive status and hides deleted routine identity without mislabeling it as rest', async () => {
    const routineId = await createRoutine('Rutina privada');
    const previousPlan = await createTrainingPlan({
      userId,
      name: 'Plan anterior',
      schedule: [{ dayOfWeek: 2, routineId }],
    });
    await archiveTrainingPlan(userId, previousPlan.plan.id, {
      mutationId: '17dcaa2a-c8a2-4e71-96e1-16d6ba943744',
      expectedPlanUpdatedAt: previousPlan.plan.updatedAt.toISOString(),
    });
    await createTrainingPlan({
      userId,
      name: 'Plan nuevo',
      schedule: [{ dayOfWeek: 3, routineId }],
    });
    await db.update(routines).set({ deletedAt: new Date() }).where(eq(routines.id, routineId));

    const hub = await getTrainingPlanHub(userId, previousPlan.plan.id);

    expect(hub.plan.isActive).toBe(false);
    expect(hub.days[1]).toEqual({ dayOfWeek: 2, assignment: { kind: 'unavailable' } });
    expect(hub.days[0]).toEqual({ dayOfWeek: 1, assignment: { kind: 'rest' } });
    expect(JSON.stringify(hub)).not.toContain('Rutina privada');
    expect(hub.days[1]?.assignment).toEqual({ kind: 'unavailable' });
  });

  it('returns NOT_FOUND for missing and foreign plan ids', async () => {
    const routineId = await createRoutine('Propia');
    const plan = await createTrainingPlan({
      userId,
      name: 'Plan propio',
      schedule: [{ dayOfWeek: 1, routineId }],
    });
    const [otherUser] = await db
      .insert(users)
      .values({
        name: 'Other Plan Hub User',
        email: `other-plan-hub-${Date.now()}-${Math.random()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();

    await expect(getTrainingPlanHub(userId, 999_999)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(getTrainingPlanHub(otherUser.id, plan.plan.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('loads only a Plan-scoped routine whose provenance matches the requested owned plan', async () => {
      const libraryRoutineId = await createRoutine('Rutina base scoped');
      const plan = await createTrainingPlan({
        userId,
        name: 'Plan propietario',
        schedule: [{ dayOfWeek: 1, routineId: libraryRoutineId }],
      });
      const [otherPlan] = await db
        .insert(trainingPlans)
        .values({ userId, name: 'Plan distinto', isActive: false })
        .returning();
      const [matchingRoutine] = await db
        .insert(routines)
        .values({
          slug: `hub-scoped-match-${Date.now()}`,
          name: 'Rutina propia del Plan',
          kind: 'gym',
          restSeconds: 90,
          isSystem: false,
          userId,
          trainingPlanId: plan.plan.id,
        })
        .returning();
      const [foreignScopeRoutine] = await db
        .insert(routines)
        .values({
          slug: `hub-scoped-other-${Date.now()}`,
          name: 'Rutina de otro Plan',
          kind: 'gym',
          restSeconds: 90,
          isSystem: false,
          userId,
          trainingPlanId: otherPlan.id,
        })
        .returning();

      await db
        .update(scheduledRoutines)
        .set({ routineId: matchingRoutine.id })
        .where(eq(scheduledRoutines.trainingPlanId, plan.plan.id));
      const matchingHub = await getTrainingPlanHub(userId, plan.plan.id);
      expect(matchingHub.days[0]?.assignment).toMatchObject({
        kind: 'routine',
        routineId: matchingRoutine.id,
        routineName: 'Rutina propia del Plan',
      });

      await db
        .update(scheduledRoutines)
        .set({ routineId: foreignScopeRoutine.id })
        .where(eq(scheduledRoutines.trainingPlanId, plan.plan.id));
      const mismatchedHub = await getTrainingPlanHub(userId, plan.plan.id);
      expect(mismatchedHub.days[0]?.assignment).toEqual({ kind: 'unavailable' });
  });
});
