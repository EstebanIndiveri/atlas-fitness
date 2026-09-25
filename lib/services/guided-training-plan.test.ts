import { beforeEach, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

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
import { createGuidedTrainingPlan } from '@/lib/services/guided-training-plan';
import { createTrainingPlan } from '@/lib/services/training-plan';
import { hashTrainingPlanImprovementValue } from '@/lib/services/training-plan-improvement-hash';

const MUTATION_ID = 'a5e2cd80-5783-4aad-a2fd-cda735384a69';

describe('guided weekly plan save service', () => {
  let userId: number;
  let exerciseId: number;

  beforeEach(async () => {
    await db.delete(guidedTrainingPlanSaves);
    await db.delete(scheduledRoutines);
    await db.delete(trainingPlans);
    await db.delete(routineExercises);
    await db.delete(routines);
    await db.delete(exercises);
    await db.delete(users);

    const [user] = await db
      .insert(users)
      .values({
        name: 'Guided Plan User',
        email: `guided-plan-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();
    userId = user.id;

    const [exercise] = await db
      .insert(exercises)
      .values({
        slug: `guided-plan-exercise-${Date.now()}`,
        name: 'Press banca',
        muscleGroup: 'Pecho',
        instructions: 'Empujá la barra.',
        isSystem: true,
        userId: null,
      })
      .returning();
    exerciseId = exercise.id;
  });

  function payload(mutationId = MUTATION_ID) {
    return {
      mutationId,
      name: 'Coach Atlas · Fuerza',
      goal: 'Fuerza',
      days: [
        {
          dayOfWeek: 1,
          note: 'Día 1 · Empuje',
          routine: {
            name: 'Coach Atlas · Día 1 · Empuje',
            description: 'Rutina propuesta para empuje.',
            kind: 'gym' as const,
            restSeconds: 120,
            exercises: [{ exerciseId, sortOrder: 0, targetSets: 3, targetReps: 8 }],
          },
        },
        {
          dayOfWeek: 3,
          note: 'Día 2 · Tirón',
          routine: {
            name: 'Coach Atlas · Día 2 · Tirón',
            description: 'Rutina propuesta para tirón.',
            kind: 'gym' as const,
            restSeconds: 120,
            exercises: [{ exerciseId, sortOrder: 0, targetSets: 3, targetReps: 10 }],
          },
        },
      ],
    };
  }

  async function createActivePlan(name: string, dayOfWeek: 1 | 3) {
    const [routine] = await db
      .insert(routines)
      .values({
        slug: `existing-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}`,
        name: `Rutina ${name}`,
        description: `Descripción ${name}`,
        kind: 'gym',
        restSeconds: 90,
        isSystem: false,
        userId,
      })
      .returning();
    await db.insert(routineExercises).values({
      routineId: routine.id,
      exerciseId,
      sortOrder: 0,
      targetSets: 4,
      targetReps: 6,
    });
    const plan = await createTrainingPlan({
      userId,
      name,
      goal: 'Fuerza inicial',
      schedule: [{ dayOfWeek, routineId: routine.id, note: `Foco ${name}` }],
    });
    return { ...plan, routine };
  }

  async function replacementState(source: {
    plan: { name: string; goal: string | null };
    schedule: Array<{ dayOfWeek: number; routineId: number; note: string | null }>;
  }) {
    const routineIds = [...new Set(source.schedule.map(({ routineId }) => routineId))].sort(
      (left, right) => left - right,
    );
    const routineRows = await db
      .select()
      .from(routines)
      .where(inArray(routines.id, routineIds))
      .orderBy(asc(routines.id));
    const exerciseRows = await db
      .select({
        routineId: routineExercises.routineId,
        exerciseId: routineExercises.exerciseId,
        sortOrder: routineExercises.sortOrder,
        targetSets: routineExercises.targetSets,
        targetReps: routineExercises.targetReps,
        isSystem: exercises.isSystem,
        userId: exercises.userId,
        exerciseName: exercises.name,
        muscleGroup: exercises.muscleGroup,
        instructions: exercises.instructions,
        imageUrl: exercises.imageUrl,
        videoUrl: exercises.videoUrl,
      })
      .from(routineExercises)
      .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
      .where(and(inArray(routineExercises.routineId, routineIds), isNull(exercises.deletedAt)))
      .orderBy(
        asc(routineExercises.routineId),
        asc(routineExercises.sortOrder),
        asc(routineExercises.exerciseId),
      );
    const exercisesByRoutineId = new Map<
      number,
      Array<(typeof exerciseRows)[number]>
    >();
    for (const exercise of exerciseRows) {
      const items = exercisesByRoutineId.get(exercise.routineId) ?? [];
      items.push(exercise);
      exercisesByRoutineId.set(exercise.routineId, items);
    }

    return {
      name: source.plan.name,
      goal: source.plan.goal,
      schedule: source.schedule.map(({ dayOfWeek, routineId, note }) => ({
        dayOfWeek: toTrainingPlanDayOfWeek(dayOfWeek),
        routineId,
        note,
      })),
      routines: routineRows.map((routine) => ({
        id: routine.id,
        slug: routine.slug,
        name: routine.name,
        description: routine.description,
        kind: routine.kind === 'home' ? 'home' as const : 'gym' as const,
        restSeconds: routine.restSeconds,
        isSystem: routine.isSystem,
        userId: routine.userId,
        deletedAt: routine.deletedAt?.toISOString() ?? null,
        exercises: (exercisesByRoutineId.get(routine.id) ?? []).map((exercise) => ({
          exerciseId: exercise.exerciseId,
          sortOrder: exercise.sortOrder,
          targetSets: exercise.targetSets,
          targetReps: exercise.targetReps,
          isSystem: exercise.isSystem,
          userId: exercise.userId,
          exerciseName: exercise.exerciseName,
          muscleGroup: exercise.muscleGroup,
          instructions: exercise.instructions,
          imageUrl: exercise.imageUrl,
          videoUrl: exercise.videoUrl,
        })),
      })),
    };
  }

  function toTrainingPlanDayOfWeek(value: number): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
    if (isTrainingPlanDayOfWeek(value)) {
      return value;
    }
    throw new Error('Unexpected day of week in test data.');
  }

  function isTrainingPlanDayOfWeek(value: number): value is 0 | 1 | 2 | 3 | 4 | 5 | 6 {
    return Number.isInteger(value) && value >= 0 && value <= 6;
  }

  async function tableCount(table: 'routines' | 'routine_exercises' | 'training_plans' | 'scheduled_routines' | 'guided_training_plan_saves'): Promise<number> {
    const result = await db.$client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
    return Number(result.rows[0]?.count ?? 0);
  }

  it('creates all routines, exercises, plan, and schedule as one save', async () => {
    const result = await createGuidedTrainingPlan(userId, payload());

    expect(result.plan).toMatchObject({
      userId,
      name: 'Coach Atlas · Fuerza',
      goal: 'Fuerza',
      isActive: true,
      deletedAt: null,
    });
    expect(result.schedule).toHaveLength(2);
    expect(result.schedule.map(({ dayOfWeek }) => dayOfWeek)).toEqual([1, 3]);
    expect(await tableCount('routines')).toBe(2);
    expect(await tableCount('routine_exercises')).toBe(2);
    expect(await tableCount('training_plans')).toBe(1);
    expect(await tableCount('scheduled_routines')).toBe(2);
    expect(await tableCount('guided_training_plan_saves')).toBe(1);

    const activePlanReferences = await db
      .select({ routineOwnerId: routines.userId, routineDeletedAt: routines.deletedAt })
      .from(scheduledRoutines)
      .innerJoin(trainingPlans, eq(scheduledRoutines.trainingPlanId, trainingPlans.id))
      .innerJoin(routines, eq(scheduledRoutines.routineId, routines.id))
      .where(
        and(
          eq(trainingPlans.isActive, true),
          isNull(trainingPlans.deletedAt),
          // Any non-null value would make the active plan point at an unavailable routine.
          eq(routines.isSystem, false),
        ),
      );
    expect(activePlanReferences).toHaveLength(2);
    expect(
      activePlanReferences.every(
        ({ routineOwnerId, routineDeletedAt }) =>
          routineOwnerId === userId && routineDeletedAt === null,
      ),
    ).toBe(true);
    const foreignKeyViolations = await db.$client.execute('PRAGMA foreign_key_check');
    expect(foreignKeyViolations.rows).toHaveLength(0);
  });

  it('accepts routine names within the guided draft title and focus limits', async () => {
    const longNamePayload = {
      ...payload(),
      days: payload().days.map((day, index) =>
        index === 0
          ? {
              ...day,
              routine: {
                ...day.routine,
                name: `Coach Atlas · ${'T'.repeat(60)} · ${'F'.repeat(80)}`,
              },
            }
          : day,
      ),
    };

    const result = await createGuidedTrainingPlan(userId, longNamePayload);

    expect(result.schedule).toHaveLength(2);
  });

  it('rolls back routines, plan, schedule, and idempotency when schedule insertion fails', async () => {
    await db.$client.execute({
      sql: `CREATE TRIGGER reject_guided_schedule
        BEFORE INSERT ON scheduled_routines
        BEGIN
          SELECT RAISE(ABORT, 'forced guided schedule failure');
        END`,
      args: [],
    });

    try {
      await expect(createGuidedTrainingPlan(userId, payload())).rejects.toThrow();
    } finally {
      await db.$client.execute('DROP TRIGGER reject_guided_schedule');
    }

    expect(await tableCount('routines')).toBe(0);
    expect(await tableCount('routine_exercises')).toBe(0);
    expect(await tableCount('training_plans')).toBe(0);
    expect(await tableCount('scheduled_routines')).toBe(0);
    expect(await tableCount('guided_training_plan_saves')).toBe(0);
  });

  it('returns the committed plan on an identical retry without creating duplicates', async () => {
    const firstResult = await createGuidedTrainingPlan(userId, payload());
    const retriedResult = await createGuidedTrainingPlan(userId, payload());

    expect(retriedResult).toEqual(firstResult);
    expect(await tableCount('routines')).toBe(2);
    expect(await tableCount('routine_exercises')).toBe(2);
    expect(await tableCount('training_plans')).toBe(1);
    expect(await tableCount('scheduled_routines')).toBe(2);
    expect(await tableCount('guided_training_plan_saves')).toBe(1);
  });

  it('replaces only the active plan named by the confirmed proposal and preserves its routines', async () => {
    const previous = await createActivePlan('Plan anterior', 1);
    const previousSchedule = await db
      .select()
      .from(scheduledRoutines)
      .where(eq(scheduledRoutines.trainingPlanId, previous.plan.id));
    const previousExercises = await db
      .select()
      .from(routineExercises)
      .where(eq(routineExercises.routineId, previous.routine.id));
    const confirmedPayload = {
      ...payload(),
      replacePlanId: previous.plan.id,
      replacePlanUpdatedAt: previous.plan.updatedAt.toISOString(),
      replacePlanStateHash: hashTrainingPlanImprovementValue(await replacementState(previous)),
    };

    const saved = await createGuidedTrainingPlan(userId, confirmedPayload);
    const retried = await createGuidedTrainingPlan(userId, confirmedPayload);

    expect(retried).toEqual(saved);
    expect(saved.plan.isActive).toBe(true);
    expect(
      await db.query.trainingPlans.findFirst({
        where: eq(trainingPlans.id, previous.plan.id),
      }),
    ).toMatchObject({ isActive: false });
    expect(
      await db
        .select()
        .from(scheduledRoutines)
        .where(eq(scheduledRoutines.trainingPlanId, previous.plan.id)),
    ).toEqual(previousSchedule);
    expect(
      await db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, previous.routine.id)),
    ).toEqual(previousExercises);
    expect(await tableCount('guided_training_plan_saves')).toBe(1);
  });

  it('rejects a stale replacement target without changing the currently active plan or assignments', async () => {
    const stale = await createActivePlan('Plan desactualizado', 1);
    const current = await createActivePlan('Plan actual', 3);
    const currentSchedule = await db
      .select()
      .from(scheduledRoutines)
      .where(eq(scheduledRoutines.trainingPlanId, current.plan.id));
    const routineCount = await tableCount('routines');
    const planCount = await tableCount('training_plans');

    await expect(
      createGuidedTrainingPlan(userId, {
        ...payload(),
        replacePlanId: stale.plan.id,
        replacePlanUpdatedAt: stale.plan.updatedAt.toISOString(),
        replacePlanStateHash: hashTrainingPlanImprovementValue(await replacementState(stale)),
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(
      await db.query.trainingPlans.findFirst({
        where: eq(trainingPlans.id, current.plan.id),
      }),
    ).toMatchObject({ isActive: true });
    expect(
      await db.query.trainingPlans.findFirst({
        where: eq(trainingPlans.id, stale.plan.id),
      }),
    ).toMatchObject({ isActive: false });
    expect(
      await db
        .select()
        .from(scheduledRoutines)
        .where(eq(scheduledRoutines.trainingPlanId, current.plan.id)),
    ).toEqual(currentSchedule);
    expect(await tableCount('routines')).toBe(routineCount);
    expect(await tableCount('training_plans')).toBe(planCount);
    expect(await tableCount('guided_training_plan_saves')).toBe(0);
  });

  it('rejects a same-second schedule edit using the captured replacement schedule', async () => {
    const source = await createActivePlan('Plan anterior', 1);
    const capturedState = await replacementState(source);
    const originalUpdatedAt = source.plan.updatedAt.toISOString();
    const sourceScheduleId = source.schedule[0]?.id;
    if (!sourceScheduleId) {
      throw new Error('The source plan schedule was not created for this test.');
    }

    await db
      .update(scheduledRoutines)
      .set({ note: 'Cambio guardado en el mismo segundo' })
      .where(eq(scheduledRoutines.id, sourceScheduleId));
    const currentPlan = await db.query.trainingPlans.findFirst({
      where: eq(trainingPlans.id, source.plan.id),
    });
    expect(currentPlan?.updatedAt.toISOString()).toBe(originalUpdatedAt);

    const routineCount = await tableCount('routines');
    const planCount = await tableCount('training_plans');
    await expect(
      createGuidedTrainingPlan(userId, {
        ...payload(),
        replacePlanId: source.plan.id,
        replacePlanUpdatedAt: originalUpdatedAt,
        replacePlanStateHash: hashTrainingPlanImprovementValue(capturedState),
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(
      await db.query.trainingPlans.findFirst({
        where: eq(trainingPlans.id, source.plan.id),
      }),
    ).toMatchObject({ isActive: true });
    expect(
      await db
        .select()
        .from(scheduledRoutines)
        .where(eq(scheduledRoutines.trainingPlanId, source.plan.id)),
    ).toMatchObject([{ note: 'Cambio guardado en el mismo segundo' }]);
    expect(await tableCount('routines')).toBe(routineCount);
    expect(await tableCount('training_plans')).toBe(planCount);
    expect(await tableCount('guided_training_plan_saves')).toBe(0);
  });

  it('binds the idempotency key to the replacement target', async () => {
    const current = await createActivePlan('Plan actual', 1);
    await createGuidedTrainingPlan(userId, {
      ...payload(),
      replacePlanId: current.plan.id,
      replacePlanUpdatedAt: current.plan.updatedAt.toISOString(),
      replacePlanStateHash: hashTrainingPlanImprovementValue(await replacementState(current)),
    });

    await expect(
      createGuidedTrainingPlan(userId, {
        ...payload(),
        replacePlanId: current.plan.id + 1,
        replacePlanUpdatedAt: current.plan.updatedAt.toISOString(),
        replacePlanStateHash: hashTrainingPlanImprovementValue(await replacementState(current)),
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await tableCount('training_plans')).toBe(2);
  });

  it('preserves the active plan and assignments when confirmed replacement fails', async () => {
    const current = await createActivePlan('Plan actual', 3);
    const currentSchedule = await db
      .select()
      .from(scheduledRoutines)
      .where(eq(scheduledRoutines.trainingPlanId, current.plan.id));
    const currentExercises = await db
      .select()
      .from(routineExercises)
      .where(eq(routineExercises.routineId, current.routine.id));
    await db.$client.execute({
      sql: `CREATE TRIGGER reject_improved_schedule
        BEFORE INSERT ON scheduled_routines
        WHEN NEW.training_plan_id != ${current.plan.id}
        BEGIN
          SELECT RAISE(ABORT, 'forced improvement schedule failure');
        END`,
      args: [],
    });

    try {
      await expect(
        createGuidedTrainingPlan(userId, {
          ...payload(),
          replacePlanId: current.plan.id,
          replacePlanUpdatedAt: current.plan.updatedAt.toISOString(),
          replacePlanStateHash: hashTrainingPlanImprovementValue(await replacementState(current)),
        }),
      ).rejects.toThrow();
    } finally {
      await db.$client.execute('DROP TRIGGER reject_improved_schedule');
    }

    expect(
      await db.query.trainingPlans.findFirst({
        where: eq(trainingPlans.id, current.plan.id),
      }),
    ).toMatchObject({ isActive: true });
    expect(
      await db
        .select()
        .from(scheduledRoutines)
        .where(eq(scheduledRoutines.trainingPlanId, current.plan.id)),
    ).toEqual(currentSchedule);
    expect(
      await db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, current.routine.id)),
    ).toEqual(currentExercises);
    expect(await tableCount('training_plans')).toBe(1);
    expect(await tableCount('guided_training_plan_saves')).toBe(0);
  });

  it('rejects mutation ID reuse with a different payload without adding rows', async () => {
    await createGuidedTrainingPlan(userId, payload());

    await expect(
      createGuidedTrainingPlan(userId, { ...payload(), name: 'Otro plan' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await tableCount('routines')).toBe(2);
    expect(await tableCount('training_plans')).toBe(1);
  });

  it('scopes the same mutation ID independently for each authenticated owner', async () => {
    const [otherUser] = await db
      .insert(users)
      .values({
        name: 'Other Guided Plan User',
        email: `guided-plan-owner-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();

    const first = await createGuidedTrainingPlan(userId, payload());
    const second = await createGuidedTrainingPlan(otherUser.id, payload());

    expect(first.plan.userId).toBe(userId);
    expect(second.plan.userId).toBe(otherUser.id);
    expect(second.plan.id).not.toBe(first.plan.id);
    expect(await tableCount('guided_training_plan_saves')).toBe(2);
    expect(await tableCount('training_plans')).toBe(2);
  });

  it('serializes concurrent duplicate submissions to one committed plan', async () => {
    const [firstResult, secondResult] = await Promise.allSettled([
      createGuidedTrainingPlan(userId, payload()),
      createGuidedTrainingPlan(userId, payload()),
    ]);
    expect(firstResult.status).toBe('fulfilled');
    expect(secondResult.status).toBe('fulfilled');
    if (firstResult.status !== 'fulfilled' || secondResult.status !== 'fulfilled') {
      return;
    }

    const first = firstResult.value;
    const second = secondResult.value;
    expect(first.plan.id).toBe(second.plan.id);
    expect(first.schedule.map(({ id }) => id)).toEqual(second.schedule.map(({ id }) => id));
    expect(await tableCount('routines')).toBe(2);
    expect(await tableCount('training_plans')).toBe(1);
    expect(await tableCount('scheduled_routines')).toBe(2);
    expect(await tableCount('guided_training_plan_saves')).toBe(1);
  });

  it('rejects an exercise owned by another user before creating any rows', async () => {
    const [otherUser] = await db
      .insert(users)
      .values({
        name: 'Other Exercise Owner',
        email: `guided-plan-other-${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('Test1234!', 10),
      })
      .returning();
    const [foreignExercise] = await db
      .insert(exercises)
      .values({
        slug: `foreign-guided-exercise-${Date.now()}`,
        name: 'Ejercicio privado',
        muscleGroup: 'Espalda',
        instructions: 'Remá.',
        isSystem: false,
        userId: otherUser.id,
      })
      .returning();
    const foreignPayload = payload();
    foreignPayload.days = foreignPayload.days.map((day, index) =>
      index === 0
        ? {
            ...day,
            routine: {
              ...day.routine,
              exercises: day.routine.exercises.map((exercise) => ({
                ...exercise,
                exerciseId: foreignExercise.id,
              })),
            },
          }
        : day,
    );

    await expect(createGuidedTrainingPlan(userId, foreignPayload)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(await tableCount('routines')).toBe(0);
    expect(await tableCount('training_plans')).toBe(0);
  });
});
