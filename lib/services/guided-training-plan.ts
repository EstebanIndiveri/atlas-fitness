import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { catalogVisibleToUser } from '@/lib/auth/ownership';
import { db } from '@/lib/db/client';
import {
  exercises,
  guidedTrainingPlanSaves,
  routineExercises,
  routines,
  scheduledRoutines,
  trainingPlans,
} from '@/lib/db/schema';
import { isSqliteBusyError } from '@/lib/db/unique-error';
import {
  hashGuidedPlanPayload,
  parseGuidedTrainingPlan,
} from '@/lib/services/guided-training-plan-input';
import { hashTrainingPlanImprovementValue } from '@/lib/services/training-plan-improvement-hash';
import type { ValidGuidedTrainingPlan } from '@/lib/services/guided-training-plan-input';
import type { CreateTrainingPlanResult } from '@/lib/services/training-plan';
import type { TrainingPlanReplacementState } from '@/types/training-plan-replacement-state';
import { AppError } from '@/types/errors';

const MAX_GUIDED_PLAN_SAVE_ATTEMPTS = 3;
const guidedPlanWriteLocks = new Map<number, Promise<void>>();

async function withUserGuidedPlanWriteLock<T>(
  userId: number,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = guidedPlanWriteLocks.get(userId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(operation);
  const lock = run.then(
    () => undefined,
    () => undefined,
  );
  guidedPlanWriteLocks.set(userId, lock);

  try {
    return await run;
  } finally {
    if (guidedPlanWriteLocks.get(userId) === lock) {
      guidedPlanWriteLocks.delete(userId);
    }
  }
}

async function withSqliteBusyRetries<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_GUIDED_PLAN_SAVE_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isSqliteBusyError(error) || attempt === MAX_GUIDED_PLAN_SAVE_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  throw new AppError('CONFLICT', 'No se pudo guardar el plan. Probá de nuevo.');
}

async function loadAssignedRoutineState(
  tx: Pick<typeof db, 'select'>,
  routineIds: number[],
): Promise<TrainingPlanReplacementState['routines']> {
  const orderedRoutineIds = [...new Set(routineIds)].sort((left, right) => left - right);
  if (orderedRoutineIds.length === 0) {
    return [];
  }

  const routineRows = await tx
    .select({
      id: routines.id,
      slug: routines.slug,
      name: routines.name,
      description: routines.description,
      kind: routines.kind,
      restSeconds: routines.restSeconds,
      isSystem: routines.isSystem,
      userId: routines.userId,
      deletedAt: routines.deletedAt,
    })
    .from(routines)
    .where(inArray(routines.id, orderedRoutineIds))
    .orderBy(asc(routines.id));
  const exerciseRows = await tx
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
    .where(
      and(inArray(routineExercises.routineId, orderedRoutineIds), isNull(exercises.deletedAt)),
    )
    .orderBy(
      asc(routineExercises.routineId),
      asc(routineExercises.sortOrder),
      asc(routineExercises.exerciseId),
    );
  const exercisesByRoutineId = new Map<
    number,
    TrainingPlanReplacementState['routines'][number]['exercises']
  >();
  for (const exercise of exerciseRows) {
    const items = exercisesByRoutineId.get(exercise.routineId) ?? [];
    items.push({
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
    });
    exercisesByRoutineId.set(exercise.routineId, items);
  }

  return routineRows.map((routine) => ({
    id: routine.id,
    slug: routine.slug,
    name: routine.name,
    description: routine.description,
    kind: normalizeRoutineKind(routine.kind),
    restSeconds: routine.restSeconds,
    isSystem: routine.isSystem,
    userId: routine.userId,
    deletedAt: routine.deletedAt?.toISOString() ?? null,
    exercises: exercisesByRoutineId.get(routine.id) ?? [],
  }));
}

function normalizeRoutineKind(value: string): 'gym' | 'home' {
  if (value !== 'gym' && value !== 'home') {
    throw new AppError('CONFLICT', 'Una rutina asignada cambió desde que se generó la propuesta.');
  }
  return value;
}

async function assertReplacementSourceState(
  tx: Pick<typeof db, 'select'>,
  userId: number,
  planId: number,
  expectedStateHash: string,
  expectedActive: boolean,
): Promise<void> {
  const [currentPlan] = await tx
    .select({
      name: trainingPlans.name,
      goal: trainingPlans.goal,
      isActive: trainingPlans.isActive,
    })
    .from(trainingPlans)
    .where(
      and(
        eq(trainingPlans.id, planId),
        eq(trainingPlans.userId, userId),
        isNull(trainingPlans.deletedAt),
      ),
    )
    .limit(1);
  const currentSchedule = await tx
    .select({
      dayOfWeek: scheduledRoutines.dayOfWeek,
      routineId: scheduledRoutines.routineId,
      note: scheduledRoutines.note,
    })
    .from(scheduledRoutines)
    .where(eq(scheduledRoutines.trainingPlanId, planId))
    .orderBy(asc(scheduledRoutines.dayOfWeek));
  if (!currentPlan || currentPlan.isActive !== expectedActive) {
    throw new AppError(
      'CONFLICT',
      'El plan cambió desde que se generó la propuesta. Generá una nueva.',
    );
  }
  const schedule = currentSchedule.map(({ dayOfWeek, routineId, note }) => {
    if (!isTrainingPlanDayOfWeek(dayOfWeek)) {
      throw new AppError('CONFLICT', 'El plan contiene un día inválido.');
    }
    return { dayOfWeek, routineId, note };
  });
  const currentRoutineState = await loadAssignedRoutineState(
    tx,
    schedule.map(({ routineId }) => routineId),
  );
  const currentState: TrainingPlanReplacementState = {
    name: currentPlan.name,
    goal: currentPlan.goal,
    schedule,
    routines: currentRoutineState,
  };
  if (hashTrainingPlanImprovementValue(currentState) !== expectedStateHash) {
    throw new AppError(
      'CONFLICT',
      'El plan cambió desde que se generó la propuesta. Generá una nueva.',
    );
  }
}

function isTrainingPlanDayOfWeek(value: number): value is 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

/**
 * Atomically creates a guided plan, its custom routines, and a user-scoped idempotency record.
 *
 * @param userId - Owner derived from the authenticated server session.
 * @param input - Untrusted guided-plan payload, including its stable client mutation ID.
 * @returns The persisted plan and its weekly routine schedule.
 * @throws {AppError} VALIDATION for malformed input, NOT_FOUND for inaccessible exercises, or CONFLICT for mutation-ID reuse.
 * @example
 * await createGuidedTrainingPlan(1, { mutationId, name: 'Semana', days: [...] });
 */
export async function createGuidedTrainingPlan(
  userId: number,
  input: unknown,
): Promise<CreateTrainingPlanResult> {
  const validInput = parseGuidedTrainingPlan(input);
  const payloadHash = hashGuidedPlanPayload(validInput);
  const mutationId = validInput.mutationId;
  const exerciseIds = [...new Set(validInput.days.flatMap(({ routine }) =>
    routine.exercises.map(({ exerciseId }) => exerciseId),
  ))];

  return withUserGuidedPlanWriteLock(userId, () =>
    withSqliteBusyRetries(() =>
      db.transaction(async (tx) => {
        const [claim] = await tx
          .insert(guidedTrainingPlanSaves)
          .values({ userId, clientMutationId: mutationId, payloadHash })
          .onConflictDoNothing({
            target: [guidedTrainingPlanSaves.userId, guidedTrainingPlanSaves.clientMutationId],
          })
          .returning({ id: guidedTrainingPlanSaves.id });

        if (!claim) {
          const [existing] = await tx
            .select()
            .from(guidedTrainingPlanSaves)
            .where(
              and(
                eq(guidedTrainingPlanSaves.userId, userId),
                eq(guidedTrainingPlanSaves.clientMutationId, mutationId),
              ),
            )
            .limit(1);

          if (!existing || existing.payloadHash !== payloadHash) {
            throw new AppError('CONFLICT', 'El ID de mutación ya fue utilizado con otra propuesta');
          }
          if (existing.trainingPlanId === null) {
            throw new AppError('CONFLICT', 'El guardado del plan todavía está en curso');
          }

          const [plan] = await tx
            .select()
            .from(trainingPlans)
            .where(eq(trainingPlans.id, existing.trainingPlanId))
            .limit(1);
          if (!plan) {
            throw new AppError('CONFLICT', 'No se pudo recuperar el plan guardado');
          }

          const schedule = await tx
            .select()
            .from(scheduledRoutines)
            .where(eq(scheduledRoutines.trainingPlanId, plan.id))
            .orderBy(asc(scheduledRoutines.dayOfWeek));

          return { plan, schedule };
        }

        const accessibleExercises = await tx
          .select({ id: exercises.id })
          .from(exercises)
          .where(
            and(
              inArray(exercises.id, exerciseIds),
              isNull(exercises.deletedAt),
              catalogVisibleToUser(exercises, userId),
            ),
          );
        if (accessibleExercises.length !== exerciseIds.length) {
          throw new AppError('NOT_FOUND', 'Ejercicio no encontrado');
        }

        const createdRoutines: Array<{
          day: ValidGuidedTrainingPlan['days'][number];
          routineId: number;
        }> = [];
        for (const [index, day] of validInput.days.entries()) {
          const slugMutationId = mutationId.replace(/-/g, '').toLowerCase();
          const [routine] = await tx
            .insert(routines)
            .values({
              slug: `guided-${userId}-${slugMutationId}-${index + 1}`,
              name: day.routine.name,
              description: day.routine.description ?? null,
              kind: day.routine.kind,
              restSeconds: day.routine.restSeconds,
              isSystem: false,
              userId,
            })
            .returning({ id: routines.id });

          await tx.insert(routineExercises).values(
            day.routine.exercises.map((exercise) => ({
              routineId: routine.id,
              exerciseId: exercise.exerciseId,
              sortOrder: exercise.sortOrder,
              targetSets: exercise.targetSets,
              targetReps: exercise.targetReps,
            })),
          );
          createdRoutines.push({ day, routineId: routine.id });
        }

        const now = new Date();
        if (
          validInput.replacePlanId !== undefined &&
          validInput.replacePlanUpdatedAt !== undefined &&
          validInput.replacePlanStateHash !== undefined
        ) {
          const expectedStateHash = validInput.replacePlanStateHash;
          await assertReplacementSourceState(
            tx,
            userId,
            validInput.replacePlanId,
            expectedStateHash,
            true,
          );

          const [replacedPlan] = await tx
            .update(trainingPlans)
            .set({ isActive: false, updatedAt: now })
            .where(
              and(
                eq(trainingPlans.id, validInput.replacePlanId),
                eq(trainingPlans.userId, userId),
                eq(trainingPlans.isActive, true),
                isNull(trainingPlans.deletedAt),
                eq(trainingPlans.updatedAt, new Date(validInput.replacePlanUpdatedAt)),
              ),
            )
            .returning({ id: trainingPlans.id });
          if (!replacedPlan) {
            throw new AppError(
              'CONFLICT',
              'El plan cambió desde que se generó la propuesta. Generá una nueva.',
            );
          }
        } else {
          await tx
            .update(trainingPlans)
            .set({ isActive: false, updatedAt: now })
            .where(and(eq(trainingPlans.userId, userId), eq(trainingPlans.isActive, true)));
        }

        const [plan] = await tx
          .insert(trainingPlans)
          .values({
            userId,
            name: validInput.name,
            goal: validInput.goal ?? null,
            isActive: true,
            updatedAt: now,
          })
          .returning();

        await tx.insert(scheduledRoutines).values(
          createdRoutines.map(({ day, routineId }) => ({
            trainingPlanId: plan.id,
            dayOfWeek: day.dayOfWeek,
            routineId,
            note: day.note ?? null,
          })),
        );

        await tx
          .update(guidedTrainingPlanSaves)
          .set({ trainingPlanId: plan.id })
          .where(eq(guidedTrainingPlanSaves.id, claim.id));

        if (
          validInput.replacePlanId !== undefined
          && validInput.replacePlanStateHash !== undefined
        ) {
          await assertReplacementSourceState(
            tx,
            userId,
            validInput.replacePlanId,
            validInput.replacePlanStateHash,
            false,
          );
        }

        const schedule = await tx
          .select()
          .from(scheduledRoutines)
          .where(eq(scheduledRoutines.trainingPlanId, plan.id))
          .orderBy(asc(scheduledRoutines.dayOfWeek));

        return { plan, schedule };
      }),
    ),
  );
}
