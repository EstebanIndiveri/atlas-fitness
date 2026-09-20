import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { catalogVisibleToUser } from '@/lib/auth/ownership';
import { db } from '@/lib/db/client';
import { routines, scheduledRoutines, trainingPlans } from '@/lib/db/schema';
import { cordobaLocalDate } from '@/lib/time/cordoba';
import { AppError } from '@/types/errors';
import type { ScheduledRoutine, TrainingPlan } from '@/lib/db/schema';

export type TrainingPlanDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TodayScheduledRoutineResult =
  | { kind: 'no_plan'; localDate: string; dayOfWeek: TrainingPlanDayOfWeek }
  | {
      kind: 'rest_day';
      localDate: string;
      dayOfWeek: TrainingPlanDayOfWeek;
      trainingPlanId: number;
      planGoal: string | null;
    }
  | {
      kind: 'workout';
      localDate: string;
      dayOfWeek: TrainingPlanDayOfWeek;
      trainingPlanId: number;
      scheduledRoutineId: number;
      routineId: number;
      routineName: string;
      planGoal: string | null;
    }
  | {
      kind: 'routine_missing';
      localDate: string;
      dayOfWeek: TrainingPlanDayOfWeek;
      trainingPlanId: number;
      scheduledRoutineId: number;
      routineId: number;
      planGoal: string | null;
    };

export interface CreateTrainingPlanResult {
  plan: TrainingPlan;
  schedule: ScheduledRoutine[];
}

const dayOfWeekSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

const createTrainingPlanSchema = z.object({
  userId: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(60).optional(),
  schedule: z
    .array(
      z.object({
        dayOfWeek: dayOfWeekSchema,
        routineId: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(7),
});

type ValidCreateTrainingPlanInput = z.infer<typeof createTrainingPlanSchema>;

function parseCreateTrainingPlanInput(input: unknown): ValidCreateTrainingPlanInput {
  const parsed = createTrainingPlanSchema.safeParse(input);

  if (!parsed.success) {
    const invalidDay = parsed.error.issues.some((issue) => issue.path.includes('dayOfWeek'));
    const emptySchedule = parsed.error.issues.some(
      (issue) => issue.path.length === 1 && issue.path[0] === 'schedule' && issue.code === 'too_small',
    );
    const message = emptySchedule
      ? 'El plan debe tener al menos un día asignado'
      : invalidDay
        ? 'Día de semana inválido'
        : 'Plan inválido';

    throw new AppError('VALIDATION', message);
  }

  const uniqueDays = new Set(parsed.data.schedule.map((item) => item.dayOfWeek));
  if (uniqueDays.size !== parsed.data.schedule.length) {
    throw new AppError('VALIDATION', 'El plan no puede repetir días');
  }

  return parsed.data;
}

function getDayOfWeekFromLocalDate(localDate: string): TrainingPlanDayOfWeek {
  const [year, month, day] = localDate.split('-').map(Number);
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  switch (utcDay) {
    case 0:
      return 0;
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    case 4:
      return 4;
    case 5:
      return 5;
    default:
      return 6;
  }
}

async function assertAccessibleRoutine(routineId: number, userId: number): Promise<void> {
  const row = await db.query.routines.findFirst({
    where: and(
      eq(routines.id, routineId),
      isNull(routines.deletedAt),
      catalogVisibleToUser(routines, userId),
    ),
  });

  if (!row) {
    throw new AppError('VALIDATION', 'Rutina no disponible');
  }
}

async function findActiveTrainingPlan(userId: number): Promise<TrainingPlan | null> {
  const plan = await db.query.trainingPlans.findFirst({
    where: and(
      eq(trainingPlans.userId, userId),
      eq(trainingPlans.isActive, true),
      isNull(trainingPlans.deletedAt),
    ),
  });

  return plan ?? null;
}

/**
 * Creates a V1 weekly TrainingPlan and makes it the user's only active plan.
 *
 * @param input - Unknown boundary payload validated with Zod before persistence.
 * @returns The active plan and its weekday schedule. Weekday is 0=Sunday through 6=Saturday.
 * @throws {AppError} VALIDATION when input or referenced routines are invalid.
 * @example
 * await createTrainingPlan({ userId: 1, name: 'Semana', schedule: [{ dayOfWeek: 1, routineId: 10 }] });
 */
export async function createTrainingPlan(input: unknown): Promise<CreateTrainingPlanResult> {
  const validInput = parseCreateTrainingPlanInput(input);
  for (const assignment of validInput.schedule) {
    await assertAccessibleRoutine(assignment.routineId, validInput.userId);
  }

  const now = new Date();
  return db.transaction(async (tx) => {
    await tx
      .update(trainingPlans)
      .set({ isActive: false, updatedAt: now })
      .where(and(eq(trainingPlans.userId, validInput.userId), eq(trainingPlans.isActive, true)));

    const [plan] = await tx
      .insert(trainingPlans)
      .values({
        userId: validInput.userId,
        name: validInput.name,
        goal: validInput.goal ?? null,
        isActive: true,
        updatedAt: now,
      })
      .returning();

    const schedule = await tx
      .insert(scheduledRoutines)
      .values(
        validInput.schedule.map((assignment) => ({
          trainingPlanId: plan.id,
          dayOfWeek: assignment.dayOfWeek,
          routineId: assignment.routineId,
        })),
      )
      .returning();

    return { plan, schedule };
  });
}

/**
 * Resolves the user's scheduled routine for the date containing `now` in Córdoba.
 *
 * @param userId - Authenticated user id.
 * @param now - Instant used to resolve local date and weekday.
 * @returns A data-honest result: no plan, rest day, workout, or missing routine.
 * @example
 * const today = await resolveTodayScheduledRoutine(1, new Date());
 */
export async function resolveTodayScheduledRoutine(
  userId: number,
  now: Date = new Date(),
): Promise<TodayScheduledRoutineResult> {
  const localDate = cordobaLocalDate(now);
  const dayOfWeek = getDayOfWeekFromLocalDate(localDate);
  const plan = await findActiveTrainingPlan(userId);

  if (!plan) {
    return { kind: 'no_plan', localDate, dayOfWeek };
  }

  const scheduled = await db.query.scheduledRoutines.findFirst({
    where: and(
      eq(scheduledRoutines.trainingPlanId, plan.id),
      eq(scheduledRoutines.dayOfWeek, dayOfWeek),
    ),
  });

  if (!scheduled) {
    return { kind: 'rest_day', localDate, dayOfWeek, trainingPlanId: plan.id, planGoal: plan.goal };
  }

  const routine = await db.query.routines.findFirst({
    where: and(
      eq(routines.id, scheduled.routineId),
      isNull(routines.deletedAt),
      catalogVisibleToUser(routines, userId),
    ),
  });

  if (!routine) {
    return {
      kind: 'routine_missing',
      localDate,
      dayOfWeek,
      trainingPlanId: plan.id,
      scheduledRoutineId: scheduled.id,
      routineId: scheduled.routineId,
      planGoal: plan.goal,
    };
  }

  return {
    kind: 'workout',
    localDate,
    dayOfWeek,
    trainingPlanId: plan.id,
    scheduledRoutineId: scheduled.id,
    routineId: routine.id,
    routineName: routine.name,
    planGoal: plan.goal,
  };
}
