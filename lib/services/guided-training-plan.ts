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
import { assertTrainingPlanTransactionState } from '@/lib/services/training-plan-transaction-state';
import type { ValidGuidedTrainingPlan } from '@/lib/services/guided-training-plan-input';
import type { CreateTrainingPlanResult } from '@/lib/services/training-plan';
import { AppError } from '@/types/errors';

const MAX_GUIDED_PLAN_SAVE_ATTEMPTS = 3;
const guidedPlanWriteLocks = new Map<number, Promise<void>>();

interface ReplacementContext {
  planId: number;
  updatedAt: Date;
  stateHash: string;
}

function replacementContext(input: ValidGuidedTrainingPlan): ReplacementContext | null {
  if (
    input.replacePlanId !== undefined
    && input.replacePlanUpdatedAt !== undefined
    && input.replacePlanStateHash !== undefined
  ) {
    return {
      planId: input.replacePlanId,
      updatedAt: new Date(input.replacePlanUpdatedAt),
      stateHash: input.replacePlanStateHash,
    };
  }
  if (
    input.replacePlanId !== undefined
    || input.replacePlanUpdatedAt !== undefined
    || input.replacePlanStateHash !== undefined
  ) {
    throw new AppError('VALIDATION', 'La versión del plan a reemplazar es inválida');
  }
  return null;
}

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
  const replacement = replacementContext(validInput);
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

        if (replacement) {
          await assertTrainingPlanTransactionState(
            tx,
            userId,
            replacement.planId,
            replacement.updatedAt,
            replacement.stateHash,
            true,
          );
        } else {
          const [activePlan] = await tx
            .select({ id: trainingPlans.id })
            .from(trainingPlans)
            .where(
              and(
                eq(trainingPlans.userId, userId),
                eq(trainingPlans.isActive, true),
                isNull(trainingPlans.deletedAt),
              ),
            )
            .limit(1);
          if (activePlan) {
            throw new AppError('CONFLICT', 'Confirmá el reemplazo del plan activo antes de guardar.');
          }
        }

        const now = new Date();
        const [plan] = await tx
          .insert(trainingPlans)
          .values({
            userId,
            name: validInput.name,
            goal: validInput.goal ?? null,
            isActive: false,
            updatedAt: now,
          })
          .returning();

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
              trainingPlanId: plan.id,
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

        await tx.insert(scheduledRoutines).values(
          createdRoutines.map(({ day, routineId }) => ({
            trainingPlanId: plan.id,
            dayOfWeek: day.dayOfWeek,
            routineId,
            note: day.note ?? null,
          })),
        );

        if (replacement) {
          await assertTrainingPlanTransactionState(
            tx,
            userId,
            replacement.planId,
            replacement.updatedAt,
            replacement.stateHash,
            true,
          );
          const [replacedPlan] = await tx
            .update(trainingPlans)
            .set({ isActive: false, updatedAt: now })
            .where(
              and(
                eq(trainingPlans.id, replacement.planId),
                eq(trainingPlans.userId, userId),
                eq(trainingPlans.isActive, true),
                isNull(trainingPlans.deletedAt),
                eq(trainingPlans.updatedAt, replacement.updatedAt),
              ),
            )
            .returning({ id: trainingPlans.id });
          if (!replacedPlan) {
            throw new AppError(
              'CONFLICT',
              'El plan cambió desde que se generó la propuesta. Generá una nueva.',
            );
          }
        }

        const [activePlan] = await tx
          .update(trainingPlans)
          .set({ isActive: true, updatedAt: now })
          .where(
            and(
              eq(trainingPlans.id, plan.id),
              eq(trainingPlans.userId, userId),
              eq(trainingPlans.isActive, false),
              isNull(trainingPlans.deletedAt),
            ),
          )
          .returning();
        if (!activePlan) {
          throw new AppError('CONFLICT', 'No se pudo activar el plan nuevo. Volvé a intentarlo.');
        }

        await tx
          .update(guidedTrainingPlanSaves)
          .set({ trainingPlanId: plan.id })
          .where(eq(guidedTrainingPlanSaves.id, claim.id));

        const schedule = await tx
          .select()
          .from(scheduledRoutines)
          .where(eq(scheduledRoutines.trainingPlanId, plan.id))
          .orderBy(asc(scheduledRoutines.dayOfWeek));

        return { plan: activePlan, schedule };
      }),
    ),
  );
}
