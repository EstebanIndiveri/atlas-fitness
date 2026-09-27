import { and, asc, eq, isNull, or } from 'drizzle-orm';

import { catalogVisibleToUser } from '@/lib/auth/ownership';
import { db } from '@/lib/db/client';
import { routines, scheduledRoutines, trainingPlans } from '@/lib/db/schema';
import type { TrainingPlanHubDto } from '@/types/training-plan-hub';
import { AppError } from '@/types/errors';
import type { RoutineKind } from '@/types/routine';
import type { TrainingPlanDayOfWeek } from '@/lib/services/training-plan';

const TRAINING_PLAN_WEEK_ORDER: readonly TrainingPlanDayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

/**
 * Loads an owned plan header and its complete seven-day view in one joined read.
 *
 * @param userId - Authenticated owner of the requested plan.
 * @param planId - Persisted training plan id.
 * @returns Plan metadata and Monday-first assignments, including actual rest and unavailable days.
 * @throws {AppError} NOT_FOUND when the plan is missing, deleted, or belongs to another user.
 * @example
 * const hub = await getTrainingPlanHub(12, 34);
 */
export async function getTrainingPlanHub(
  userId: number,
  planId: number,
): Promise<TrainingPlanHubDto> {
  const rows = await db
    .select({
      plan: {
        id: trainingPlans.id,
        name: trainingPlans.name,
        goal: trainingPlans.goal,
        isActive: trainingPlans.isActive,
        updatedAt: trainingPlans.updatedAt,
      },
      assignment: {
        dayOfWeek: scheduledRoutines.dayOfWeek,
        routineId: scheduledRoutines.routineId,
        focus: scheduledRoutines.note,
      },
      routine: {
        id: routines.id,
        name: routines.name,
        description: routines.description,
        kind: routines.kind,
      },
    })
    .from(trainingPlans)
    .leftJoin(
      scheduledRoutines,
      eq(scheduledRoutines.trainingPlanId, trainingPlans.id),
    )
    .leftJoin(
      routines,
      and(
        eq(routines.id, scheduledRoutines.routineId),
        isNull(routines.deletedAt),
        catalogVisibleToUser(routines, userId),
        or(routines.isSystem, isNull(routines.trainingPlanId), eq(routines.trainingPlanId, planId)),
      ),
    )
    .where(
      and(
        eq(trainingPlans.id, planId),
        eq(trainingPlans.userId, userId),
        isNull(trainingPlans.deletedAt),
      ),
    )
    .orderBy(asc(scheduledRoutines.dayOfWeek));

  const firstRow = rows[0];
  if (!firstRow) {
    throw new AppError('NOT_FOUND', 'Plan no encontrado');
  }

  const scheduledDays = new Map<TrainingPlanDayOfWeek, TrainingPlanHubDto['days'][number]['assignment']>();

  for (const row of rows) {
    if (!row.assignment || row.assignment.dayOfWeek === null || row.assignment.routineId === null) {
      continue;
    }

    if (!isTrainingPlanDayOfWeek(row.assignment.dayOfWeek)) {
      throw new Error('El plan guardado contiene un día de semana inválido');
    }

    if (!row.routine) {
      scheduledDays.set(row.assignment.dayOfWeek, { kind: 'unavailable' });
      continue;
    }

    scheduledDays.set(row.assignment.dayOfWeek, {
      kind: 'routine',
      routineId: row.routine.id,
      routineName: row.routine.name,
      routineDescription: row.routine.description,
      routineKind: asRoutineKind(row.routine.kind),
      focus: row.assignment.focus,
    });
  }

  return {
    plan: {
      ...firstRow.plan,
      updatedAt: firstRow.plan.updatedAt.toISOString(),
    },
    days: TRAINING_PLAN_WEEK_ORDER.map((dayOfWeek) => ({
      dayOfWeek,
      assignment: scheduledDays.get(dayOfWeek) ?? { kind: 'rest' },
    })),
  };
}

function isTrainingPlanDayOfWeek(value: number): value is TrainingPlanDayOfWeek {
  return value >= 0 && value <= 6 && Number.isInteger(value);
}

function asRoutineKind(value: string): RoutineKind {
  return value === 'home' ? 'home' : 'gym';
}
