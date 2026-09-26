import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  exercises,
  guidedTrainingPlanSaves,
  routineExercises,
  routines,
  scheduledRoutines,
  trainingPlans,
  users,
} from '@/lib/db/schema';
import { createTrainingPlan } from '@/lib/services/training-plan';
import {
  confirmTrainingPlanImprovement,
  generateTrainingPlanImprovementProposal,
} from '@/lib/services/training-plan-improvement';

const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalSessionSecret = process.env.SESSION_SECRET;

describe('generateTrainingPlanImprovementProposal', () => {
  let userId: number;
  let planId: number;
  let routineId: number;
  let exerciseId: number;

  beforeEach(async () => {
    await db.delete(guidedTrainingPlanSaves);
    await db.delete(scheduledRoutines);
    await db.delete(routineExercises);
    await db.delete(routines);
    await db.delete(trainingPlans);
    await db.delete(exercises);
    await db.delete(users);
    process.env.GEMINI_API_KEY = '';
    process.env.SESSION_SECRET = 'test-plan-improvement-session-secret';

    const [user] = await db
      .insert(users)
      .values({
        name: 'Plan Improvement User',
        email: `plan-improvement-${Date.now()}-${Math.random()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();
    userId = user.id;

    const [exercise] = await db
      .insert(exercises)
      .values({
        slug: `improvement-exercise-${Date.now()}-${Math.random()}`,
        name: 'Sentadilla',
        muscleGroup: 'Piernas',
        instructions: 'Bajá con control.',
        isSystem: true,
        userId: null,
      })
      .returning();
    exerciseId = exercise.id;

    const [routine] = await db
      .insert(routines)
      .values({
        slug: `improvement-routine-${Date.now()}-${Math.random()}`,
        name: 'Rutina base',
        description: 'Plan de referencia',
        kind: 'gym',
        restSeconds: 90,
        isSystem: false,
        userId,
      })
      .returning();
    routineId = routine.id;
    await db.insert(routineExercises).values({
      routineId,
      exerciseId: exercise.id,
      sortOrder: 0,
      targetSets: 4,
      targetReps: 6,
    });
    const plan = await createTrainingPlan({
      userId,
      name: 'Semana base',
      goal: 'Ganar fuerza',
      schedule: [
        { dayOfWeek: 2, routineId, note: 'Técnica' },
        { dayOfWeek: 6, routineId, note: 'Volumen' },
      ],
    });
    planId = plan.plan.id;
  });

  afterAll(() => {
    if (originalGeminiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
    if (originalSessionSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = originalSessionSecret;
    }
  });

  it('builds an explicit proposal from the owned active plan without persisting changes', async () => {
    const originalPlan = await db.query.trainingPlans.findFirst({
      where: eq(trainingPlans.id, planId),
    });
    const originalSchedule = await db
      .select()
      .from(scheduledRoutines)
      .where(eq(scheduledRoutines.trainingPlanId, planId));
    const originalRoutine = await db.query.routines.findFirst({
      where: eq(routines.id, routineId),
    });
    const originalRoutineExercises = await db
      .select()
      .from(routineExercises)
      .where(eq(routineExercises.routineId, routineId));

    const result = await generateTrainingPlanImprovementProposal(userId, planId, {
      intent: '  reducir volumen sin perder constancia  ',
    });

    expect(result.intent).toBe('reducir volumen sin perder constancia');
    expect(result.currentPlan.plan).toMatchObject({
      id: planId,
      name: 'Semana base',
      isActive: true,
    });
    expect(result.currentPlan.days[1]).toMatchObject({
      dayOfWeek: 2,
      assignment: {
        kind: 'routine',
        routineId,
        routineName: 'Rutina base',
        focus: 'Técnica',
        exercises: [
          {
            exerciseId: expect.any(Number),
            exerciseName: 'Sentadilla',
            targetSets: 4,
            targetReps: 6,
          },
        ],
      },
    });
    expect(result.proposal.source).toBe('fallback');
    expect(result.proposal.goal).toBe(result.intent);
    expect(result.proposal.days.map(({ dayOfWeek }) => dayOfWeek)).toEqual([2, 6]);
    expect(result.proposal.days.every(({ exercises: items }) => items.length > 0)).toBe(true);

    expect(
      await db.query.trainingPlans.findFirst({ where: eq(trainingPlans.id, planId) }),
    ).toEqual(originalPlan);
    expect(
      await db
        .select()
        .from(scheduledRoutines)
        .where(eq(scheduledRoutines.trainingPlanId, planId)),
    ).toEqual(originalSchedule);
    expect(await db.query.routines.findFirst({ where: eq(routines.id, routineId) })).toEqual(
      originalRoutine,
    );
    expect(
      await db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, routineId)),
    ).toEqual(originalRoutineExercises);
    expect(
      await db.select().from(trainingPlans).where(eq(trainingPlans.userId, userId)),
    ).toHaveLength(1);
  });

  it('canonicalizes multiline intent consistently in the response and generated proposal', async () => {
    const result = await generateTrainingPlanImprovementProposal(userId, planId, {
      intent: 'reducir\nvolumen',
    });

    expect(result.intent).toBe('reducir volumen');
    expect(result.proposal.goal).toBe('reducir volumen');
  });

  it.each(['', '   ', 'x', 'x'.repeat(61), null, 42])(
    'rejects missing or invalid user intent %p without generating or persisting a proposal',
    async (intent) => {
      const originalPlan = await db.query.trainingPlans.findFirst({
        where: eq(trainingPlans.id, planId),
      });
      await expect(
        generateTrainingPlanImprovementProposal(userId, planId, { intent }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });

      expect(
        await db.query.trainingPlans.findFirst({ where: eq(trainingPlans.id, planId) }),
      ).toEqual(originalPlan);
      expect(
        await db
          .select()
          .from(scheduledRoutines)
          .where(eq(scheduledRoutines.trainingPlanId, planId)),
      ).toHaveLength(2);
      expect(
        await db
          .select()
          .from(routineExercises)
          .where(eq(routineExercises.routineId, routineId)),
      ).toHaveLength(1);
    },
  );

  it('preserves the active plan and its routine when proposal generation has no accessible catalog', async () => {
    const [otherUser] = await db
      .insert(users)
      .values({
        name: 'Other Catalog Owner',
        email: `other-catalog-${Date.now()}-${Math.random()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();
    if (!otherUser) {
      throw new Error('Could not create the catalog owner for this test.');
    }
    await db
      .update(exercises)
      .set({ isSystem: false, userId: otherUser.id })
      .where(eq(exercises.id, exerciseId));
    const originalPlan = await db.query.trainingPlans.findFirst({
      where: eq(trainingPlans.id, planId),
    });
    const originalSchedule = await db
      .select()
      .from(scheduledRoutines)
      .where(eq(scheduledRoutines.trainingPlanId, planId));
    const originalRoutineExercises = await db
      .select()
      .from(routineExercises)
      .where(eq(routineExercises.routineId, routineId));

    await expect(
      generateTrainingPlanImprovementProposal(userId, planId, { intent: 'mejorar fuerza' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    expect(
      await db.query.trainingPlans.findFirst({ where: eq(trainingPlans.id, planId) }),
    ).toEqual(originalPlan);
    expect(
      await db
        .select()
        .from(scheduledRoutines)
        .where(eq(scheduledRoutines.trainingPlanId, planId)),
    ).toEqual(originalSchedule);
    expect(
      await db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, routineId)),
    ).toEqual(originalRoutineExercises);
    expect(await db.select().from(trainingPlans)).toHaveLength(1);
  });

  it('rejects a non-active or foreign plan instead of deriving from another source', async () => {
    await db
      .update(trainingPlans)
      .set({ isActive: false })
      .where(eq(trainingPlans.id, planId));

    await expect(
      generateTrainingPlanImprovementProposal(userId, planId, { intent: 'mejorar fuerza' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    await expect(
      generateTrainingPlanImprovementProposal(userId + 1, planId, { intent: 'mejorar fuerza' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('replaces the source plan only on confirmation and replays the same save idempotently', async () => {
    const generated = await generateTrainingPlanImprovementProposal(userId, planId, {
      intent: 'reducir volumen sin perder constancia',
    });
    const oldSchedule = await db
      .select()
      .from(scheduledRoutines)
      .where(eq(scheduledRoutines.trainingPlanId, planId));
    const oldExercises = await db
      .select()
      .from(routineExercises)
      .where(eq(routineExercises.routineId, routineId));
    const confirmation = {
      mutationId: '6a38f5b3-e504-4e63-99f5-7d9f537fd9c6',
      intent: generated.intent,
      expectedPlanUpdatedAt: generated.currentPlan.plan.updatedAt,
      confirmationToken: generated.confirmationToken,
      proposal: generated.proposal,
    };

    const saved = await confirmTrainingPlanImprovement(userId, planId, confirmation);
    const retried = await confirmTrainingPlanImprovement(userId, planId, confirmation);

    expect(retried).toEqual(saved);
    expect(saved.plan.isActive).toBe(true);
    expect(saved.plan.goal).toBe(generated.intent);
    expect(
      await db.query.trainingPlans.findFirst({ where: eq(trainingPlans.id, planId) }),
    ).toMatchObject({ isActive: false });
    expect(
      await db
        .select()
        .from(scheduledRoutines)
        .where(eq(scheduledRoutines.trainingPlanId, planId)),
    ).toEqual(oldSchedule);
    expect(
      await db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, routineId)),
    ).toEqual(oldExercises);
    expect(
      await db.select().from(trainingPlans).where(eq(trainingPlans.isActive, true)),
    ).toHaveLength(1);
    expect(await db.select().from(guidedTrainingPlanSaves)).toHaveLength(1);
    const scopedRoutines = await db.$client.execute({
      sql: 'SELECT training_plan_id FROM routines WHERE user_id = ? ORDER BY id',
      args: [userId],
    });
    expect(scopedRoutines.rows).toHaveLength(saved.schedule.length + 1);
    expect(scopedRoutines.rows.filter(({ training_plan_id }) => training_plan_id === null)).toHaveLength(1);
    expect(
      scopedRoutines.rows
        .filter(({ training_plan_id }) => training_plan_id !== null)
        .map(({ training_plan_id }) => training_plan_id),
    ).toEqual(saved.schedule.map(() => saved.plan.id));
  });

  it('rejects an unissued confirmation and preserves the active plan and assignments', async () => {
    const generated = await generateTrainingPlanImprovementProposal(userId, planId, {
      intent: 'reducir volumen',
    });
    const originalSchedule = await db
      .select()
      .from(scheduledRoutines)
      .where(eq(scheduledRoutines.trainingPlanId, planId));
    const originalRoutineExercises = await db
      .select()
      .from(routineExercises)
      .where(eq(routineExercises.routineId, routineId));

    await expect(
      confirmTrainingPlanImprovement(userId, planId, {
        mutationId: '0b2a1b03-38a9-4a5e-a0ee-44d11b47ff90',
        intent: generated.intent,
        expectedPlanUpdatedAt: generated.currentPlan.plan.updatedAt,
        proposal: generated.proposal,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });

    expect(
      await db.query.trainingPlans.findFirst({ where: eq(trainingPlans.id, planId) }),
    ).toMatchObject({ isActive: true });
    expect(
      await db
        .select()
        .from(scheduledRoutines)
        .where(eq(scheduledRoutines.trainingPlanId, planId)),
    ).toEqual(originalSchedule);
    expect(
      await db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, routineId)),
    ).toEqual(originalRoutineExercises);
    expect(await db.select().from(guidedTrainingPlanSaves)).toHaveLength(0);
  });

  it('rejects a proposal altered after its receipt was issued', async () => {
    const generated = await generateTrainingPlanImprovementProposal(userId, planId, {
      intent: 'reducir volumen',
    });

    await expect(
      confirmTrainingPlanImprovement(userId, planId, {
        mutationId: '2c012eba-13df-4c0e-986f-fd12bc600915',
        intent: generated.intent,
        expectedPlanUpdatedAt: generated.currentPlan.plan.updatedAt,
        confirmationToken: generated.confirmationToken,
        proposal: { ...generated.proposal, name: 'Propuesta fabricada' },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(
      await db.query.trainingPlans.findFirst({ where: eq(trainingPlans.id, planId) }),
    ).toMatchObject({ isActive: true });
    expect(
      await db
        .select()
        .from(scheduledRoutines)
        .where(eq(scheduledRoutines.trainingPlanId, planId)),
    ).toHaveLength(2);
    expect(await db.select().from(guidedTrainingPlanSaves)).toHaveLength(0);
  });

  it('preserves the plan if an assigned routine changes after confirmation preflight', async () => {
    const generated = await generateTrainingPlanImprovementProposal(userId, planId, {
      intent: 'reducir volumen',
    });
    await db.$client.execute({
      sql: `CREATE TRIGGER mutate_assigned_routine_during_improvement
        AFTER INSERT ON training_plans
        WHEN NEW.user_id = ${userId} AND NEW.id != ${planId}
        BEGIN
          UPDATE routines
          SET name = 'Rutina editada después de la propuesta'
          WHERE id = ${routineId};
          UPDATE routine_exercises
          SET target_sets = 5
          WHERE routine_id = ${routineId};
        END`,
      args: [],
    });
    try {
      await expect(
        confirmTrainingPlanImprovement(userId, planId, {
          mutationId: 'f16dfb2a-c379-4f9b-bc77-81f66fbd4c81',
          intent: generated.intent,
          expectedPlanUpdatedAt: generated.currentPlan.plan.updatedAt,
          confirmationToken: generated.confirmationToken,
          proposal: generated.proposal,
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    } finally {
      await db.$client.execute('DROP TRIGGER mutate_assigned_routine_during_improvement');
    }

    expect(
      await db.query.trainingPlans.findFirst({ where: eq(trainingPlans.id, planId) }),
    ).toMatchObject({ isActive: true });
    expect(
      await db
        .select()
        .from(scheduledRoutines)
        .where(eq(scheduledRoutines.trainingPlanId, planId)),
    ).toHaveLength(2);
    expect(await db.select().from(trainingPlans)).toHaveLength(1);
    expect(await db.select().from(routines)).toHaveLength(1);
    expect(await db.select().from(guidedTrainingPlanSaves)).toHaveLength(0);
    expect(await db.query.routines.findFirst({ where: eq(routines.id, routineId) })).toMatchObject({
      name: 'Rutina base',
    });
    expect(
      await db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, routineId)),
    ).toMatchObject([{ targetSets: 4 }]);
  });

  it('rejects a proposal after its source plan changes and preserves the newer assignments', async () => {
    const generated = await generateTrainingPlanImprovementProposal(userId, planId, {
      intent: 'mejorar equilibrio semanal',
    });
    const oldSchedule = await db
      .select()
      .from(scheduledRoutines)
      .where(eq(scheduledRoutines.trainingPlanId, planId));
    await db
      .update(trainingPlans)
      .set({ updatedAt: new Date(Date.parse(generated.currentPlan.plan.updatedAt) + 5_000) })
      .where(eq(trainingPlans.id, planId));

    await expect(
      confirmTrainingPlanImprovement(userId, planId, {
        mutationId: 'aa9c2988-9c0c-4be1-b24b-42a43a772c31',
        intent: generated.intent,
        expectedPlanUpdatedAt: generated.currentPlan.plan.updatedAt,
        confirmationToken: generated.confirmationToken,
        proposal: generated.proposal,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(
      await db.query.trainingPlans.findFirst({ where: eq(trainingPlans.id, planId) }),
    ).toMatchObject({ isActive: true });
    expect(
      await db
        .select()
        .from(scheduledRoutines)
        .where(eq(scheduledRoutines.trainingPlanId, planId)),
    ).toEqual(oldSchedule);
    expect(await db.select().from(guidedTrainingPlanSaves)).toHaveLength(0);
  });
});
