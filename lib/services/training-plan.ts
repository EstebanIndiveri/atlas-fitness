import { createHash } from 'node:crypto';
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { z } from 'zod';

import { catalogVisibleToUser } from '@/lib/auth/ownership';
import { db } from '@/lib/db/client';
import { isSqliteBusyError, isUniqueConstraintError } from '@/lib/db/unique-error';
import {
  guidedTrainingPlanSaves,
  routineExercises,
  routines,
  scheduledRoutines,
  trainingPlans,
  workouts,
} from '@/lib/db/schema';
import { buildDayReason, type DayReasonEnergy } from '@/lib/services/day-reason';
import { getTodayCheckIn } from '@/lib/services/daily-checkin';
import { getTodayRoutineCompletion, type RoutineCompletion } from '@/lib/services/routine-completion';
import { hashTrainingPlanImprovementValue } from '@/lib/services/training-plan-improvement-hash';
import { loadTrainingPlanReplacementState } from '@/lib/services/training-plan-improvement-state';
import { assertTrainingPlanTransactionState } from '@/lib/services/training-plan-transaction-state';
import { addLocalDateDays, cordobaLocalDate, cordobaLocalDateToUtcRange } from '@/lib/time/cordoba';
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
      dayReason: string | null;
      completion: RoutineCompletion;
    }
  | {
      kind: 'routine_missing';
      localDate: string;
      dayOfWeek: TrainingPlanDayOfWeek;
      trainingPlanId: number;
      scheduledRoutineId: number;
      routineId: number;
      planGoal: string | null;
      dayReason: string | null;
    };

export interface CreateTrainingPlanResult {
  plan: TrainingPlan;
  schedule: ScheduledRoutine[];
  replacementStateHash?: string;
}

const MAX_PLAN_WRITE_ATTEMPTS = 3;
const trainingPlanWriteLocks = new Map<number, Promise<void>>();

async function withUserTrainingPlanWriteLock<T>(
  userId: number,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = trainingPlanWriteLocks.get(userId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(operation);
  const lock = run.then(
    () => undefined,
    () => undefined,
  );
  trainingPlanWriteLocks.set(userId, lock);
  try {
    return await run;
  } finally {
    if (trainingPlanWriteLocks.get(userId) === lock) {
      trainingPlanWriteLocks.delete(userId);
    }
  }
}

async function withPlanWriteRetries<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_PLAN_WRITE_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError('CONFLICT', 'El estado activo del plan cambió. Volvé a intentarlo.');
      }
      if (!isSqliteBusyError(error) || attempt === MAX_PLAN_WRITE_ATTEMPTS - 1) {
        throw error;
      }
    }
  }
  throw new AppError('CONFLICT', 'No se pudo guardar el plan. Volvé a intentarlo.');
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

const createTrainingPlanBaseSchema = z.object({
  userId: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(60).optional(),
  mutationId: z.string().uuid().optional(),
  replacePlanId: z.number().int().positive().optional(),
  replacePlanUpdatedAt: z.string().datetime().optional(),
  replacePlanStateHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  schedule: z
    .array(
      z.object({
        dayOfWeek: dayOfWeekSchema,
        routineId: z.number().int().positive(),
        note: z.string().trim().min(1).max(140).optional(),
      }),
    )
    .min(1)
    .max(7),
});

const createTrainingPlanSchema = createTrainingPlanBaseSchema.refine((value) => {
  const replacementFields = [
    value.replacePlanId,
    value.replacePlanUpdatedAt,
    value.replacePlanStateHash,
  ];
  const providedFields = replacementFields.filter((field) => field !== undefined).length;
  return providedFields === 0 || providedFields === replacementFields.length;
}, { message: 'La versión del plan a reemplazar es inválida' });

type ValidCreateTrainingPlanInput = z.infer<typeof createTrainingPlanSchema>;
type ValidTrainingPlanWriteInput = Omit<ValidCreateTrainingPlanInput, 'userId'>;

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
  if (
    parsed.data.replacePlanId !== undefined
    && parsed.data.mutationId === undefined
  ) {
    throw new AppError('VALIDATION', 'El reemplazo requiere un ID de mutación');
  }

  return parsed.data;
}

function parseTrainingPlanWriteInput(input: unknown): ValidTrainingPlanWriteInput {
  const parsed = createTrainingPlanBaseSchema.omit({ userId: true }).safeParse(input);

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

function hashCreateTrainingPlanPayload(input: ValidCreateTrainingPlanInput): string {
  const payload = {
    userId: input.userId,
    name: input.name,
    goal: input.goal ?? null,
    schedule: input.schedule.map(({ dayOfWeek, routineId, note }) => ({
      dayOfWeek,
      routineId,
      note: note ?? null,
    })),
    replacePlanId: input.replacePlanId ?? null,
    replacePlanUpdatedAt: input.replacePlanUpdatedAt ?? null,
    replacePlanStateHash: input.replacePlanStateHash ?? null,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function loadPlanSaveReceipt(
  tx: Pick<typeof db, 'select'>,
  userId: number,
  mutationId: string,
  payloadHash: string,
): Promise<CreateTrainingPlanResult | null> {
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
  if (!existing) {
    return null;
  }
  if (existing.payloadHash !== payloadHash || existing.trainingPlanId === null) {
    throw new AppError('CONFLICT', 'El ID de mutación ya fue utilizado con otra propuesta');
  }
  const [plan] = await tx
    .select()
    .from(trainingPlans)
    .where(and(eq(trainingPlans.id, existing.trainingPlanId), eq(trainingPlans.userId, userId)))
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

async function assertRoutinesAssignable(
  tx: Pick<typeof db, 'select'>,
  assignments: ValidTrainingPlanWriteInput['schedule'],
  userId: number,
  sourcePlanId: number | null,
): Promise<void> {
  const routineIds = [...new Set(assignments.map(({ routineId }) => routineId))];
  const rows = await tx
    .select({
      id: routines.id,
      userId: routines.userId,
      isSystem: routines.isSystem,
      trainingPlanId: routines.trainingPlanId,
    })
    .from(routines)
    .where(
      and(
        inArray(routines.id, routineIds),
        isNull(routines.deletedAt),
        catalogVisibleToUser(routines, userId),
      ),
    );
  const assignableIds = new Set(
    rows
      .filter((routine) =>
        routine.isSystem
        || routine.trainingPlanId === null
        || (
          sourcePlanId !== null
          && routine.trainingPlanId === sourcePlanId
          && routine.userId === userId
        ),
      )
      .map(({ id }) => id),
  );
  if (assignableIds.size !== routineIds.length) {
    throw new AppError('VALIDATION', 'Rutina no disponible');
  }
}

async function cloneAssignedPlanRoutines(
  tx: Pick<typeof db, 'select' | 'insert'>,
  assignments: ValidTrainingPlanWriteInput['schedule'],
  userId: number,
  sourcePlanId: number | null,
  targetPlanId: number,
): Promise<Map<number, number>> {
  const sourceRoutineIds = [...new Set(assignments.map(({ routineId }) => routineId))];
  if (sourcePlanId === null || sourceRoutineIds.length === 0) {
    return new Map();
  }
  const sourceRoutines = await tx
    .select()
    .from(routines)
    .where(
      and(
        inArray(routines.id, sourceRoutineIds),
        eq(routines.userId, userId),
        eq(routines.trainingPlanId, sourcePlanId),
        isNull(routines.deletedAt),
      ),
    );
  const clones = new Map<number, number>();
  for (const source of sourceRoutines) {
    const [clone] = await tx
      .insert(routines)
      .values({
        slug: `plan-${targetPlanId}-routine-${source.id}`,
        name: source.name,
        description: source.description,
        kind: source.kind,
        restSeconds: source.restSeconds,
        isSystem: false,
        userId,
        trainingPlanId: targetPlanId,
      })
      .returning({ id: routines.id });
    const exercises = await tx
      .select({
        exerciseId: routineExercises.exerciseId,
        sortOrder: routineExercises.sortOrder,
        targetSets: routineExercises.targetSets,
        targetReps: routineExercises.targetReps,
      })
      .from(routineExercises)
      .where(eq(routineExercises.routineId, source.id));
    if (exercises.length > 0) {
      await tx.insert(routineExercises).values(
        exercises.map((exercise) => ({
          routineId: clone.id,
          ...exercise,
        })),
      );
    }
    clones.set(source.id, clone.id);
  }
  return clones;
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
 * Returns the id of the authenticated user's active, non-deleted training plan.
 *
 * @param userId - Authenticated owner whose plan should be resolved.
 * @returns The active training plan id, or `null` when no plan is active.
 * @throws Database errors when the active plan cannot be read.
 * @example await getActiveTrainingPlanId(42);
 */
export async function getActiveTrainingPlanId(userId: number): Promise<number | null> {
  const plan = await findActiveTrainingPlan(userId);
  return plan?.id ?? null;
}

/**
 * Loads the authenticated user's active plan and its replacement snapshot, if one exists.
 *
 * @param userId - Authenticated owner whose active plan should be loaded.
 * @returns The active plan with its schedule and replacement hash, or null.
 */
export async function getActiveTrainingPlan(
  userId: number,
): Promise<CreateTrainingPlanResult | null> {
  const plan = await findActiveTrainingPlan(userId);
  return plan ? getTrainingPlanById(userId, plan.id) : null;
}

async function findOwnedTrainingPlan(userId: number, planId: number): Promise<TrainingPlan> {
  const plan = await db.query.trainingPlans.findFirst({
    where: and(
      eq(trainingPlans.id, planId),
      eq(trainingPlans.userId, userId),
      isNull(trainingPlans.deletedAt),
    ),
  });

  if (!plan) {
    throw new AppError('NOT_FOUND', 'Plan no encontrado');
  }

  return plan;
}

async function loadPlanSchedule(planId: number): Promise<ScheduledRoutine[]> {
  return db.query.scheduledRoutines.findMany({
    where: eq(scheduledRoutines.trainingPlanId, planId),
    orderBy: [asc(scheduledRoutines.dayOfWeek)],
  });
}

function isDayReasonEnergy(value: string | null): value is DayReasonEnergy {
  return value === 'low' || value === 'medium' || value === 'high';
}

async function didUserTrainOnLocalDate(userId: number, localDate: string): Promise<boolean> {
  const { startUtc, endUtc } = cordobaLocalDateToUtcRange(localDate);
  const workout = await db.query.workouts.findFirst({
    where: and(
      eq(workouts.userId, userId),
      isNull(workouts.deletedAt),
      isNotNull(workouts.endedAt),
      gte(workouts.endedAt, startUtc),
      lt(workouts.endedAt, endUtc),
    ),
    columns: { id: true },
  });

  return workout !== undefined;
}

async function buildTodayTrainingPlanDayReason(
  userId: number,
  localDate: string,
  planGoal: string | null,
  now: Date,
): Promise<string> {
  const yesterday = addLocalDateDays(localDate, -1);
  const [checkIn, trainedYesterday] = await Promise.all([
    getTodayCheckIn(userId, now),
    didUserTrainOnLocalDate(userId, yesterday),
  ]);
  const checkInEnergy = checkIn?.energy ?? null;

  return buildDayReason({
    energy: isDayReasonEnergy(checkInEnergy) ? checkInEnergy : null,
    mood: checkIn?.mood ?? null,
    restedYesterday: !trainedYesterday,
    goal: planGoal,
  });
}

/**
 * Creates a V1 weekly TrainingPlan draft and atomically activates it after any confirmed replacement.
 *
 * @param input - Unknown boundary payload validated with Zod before persistence.
 * @returns The active plan and its weekday schedule. Weekday is 0=Sunday through 6=Saturday.
 * @throws {AppError} VALIDATION when input or referenced routines are invalid, or CONFLICT when a replacement is unconfirmed/stale.
 * @example
 * await createTrainingPlan({ userId: 1, name: 'Semana', schedule: [{ dayOfWeek: 1, routineId: 10 }] });
 */
export async function createTrainingPlan(input: unknown): Promise<CreateTrainingPlanResult> {
  const validInput = parseCreateTrainingPlanInput(input);
  const payloadHash = hashCreateTrainingPlanPayload(validInput);
  const now = new Date();
  return withUserTrainingPlanWriteLock(
    validInput.userId,
    () => withPlanWriteRetries(() => db.transaction(async (tx) => {
    if (validInput.mutationId) {
      const [claim] = await tx
        .insert(guidedTrainingPlanSaves)
        .values({
          userId: validInput.userId,
          clientMutationId: validInput.mutationId,
          payloadHash,
        })
        .onConflictDoNothing({
          target: [
            guidedTrainingPlanSaves.userId,
            guidedTrainingPlanSaves.clientMutationId,
          ],
        })
        .returning({ id: guidedTrainingPlanSaves.id });
      if (!claim) {
        const receipt = await loadPlanSaveReceipt(
          tx,
          validInput.userId,
          validInput.mutationId,
          payloadHash,
        );
        if (receipt) {
          return receipt;
        }
      }
    }

    if (validInput.replacePlanId !== undefined) {
      await assertTrainingPlanTransactionState(
        tx,
        validInput.userId,
        validInput.replacePlanId,
        new Date(validInput.replacePlanUpdatedAt ?? ''),
        validInput.replacePlanStateHash ?? '',
        true,
      );
    } else {
      const [activePlan] = await tx
        .select({ id: trainingPlans.id })
        .from(trainingPlans)
        .where(
          and(
            eq(trainingPlans.userId, validInput.userId),
            eq(trainingPlans.isActive, true),
            isNull(trainingPlans.deletedAt),
          ),
        )
        .limit(1);
      if (activePlan) {
        throw new AppError('CONFLICT', 'Confirmá el reemplazo del plan activo antes de guardar.');
      }
    }

    await assertRoutinesAssignable(
      tx,
      validInput.schedule,
      validInput.userId,
      validInput.replacePlanId ?? null,
    );

    const [plan] = await tx
      .insert(trainingPlans)
      .values({
        userId: validInput.userId,
        name: validInput.name,
        goal: validInput.goal ?? null,
        isActive: false,
        updatedAt: now,
      })
      .returning();

    const clonedRoutineIds = await cloneAssignedPlanRoutines(
      tx,
      validInput.schedule,
      validInput.userId,
      validInput.replacePlanId ?? null,
      plan.id,
    );
    const schedule = await tx
      .insert(scheduledRoutines)
      .values(
        validInput.schedule.map((assignment) => ({
          trainingPlanId: plan.id,
          dayOfWeek: assignment.dayOfWeek,
          routineId: clonedRoutineIds.get(assignment.routineId) ?? assignment.routineId,
          note: assignment.note ?? null,
        })),
      )
      .returning();

    if (validInput.replacePlanId !== undefined) {
      await assertTrainingPlanTransactionState(
        tx,
        validInput.userId,
        validInput.replacePlanId,
        new Date(validInput.replacePlanUpdatedAt ?? ''),
        validInput.replacePlanStateHash ?? '',
        true,
      );
      const [replaced] = await tx
        .update(trainingPlans)
        .set({ isActive: false, updatedAt: now })
        .where(
          and(
            eq(trainingPlans.id, validInput.replacePlanId),
            eq(trainingPlans.userId, validInput.userId),
            eq(trainingPlans.isActive, true),
            isNull(trainingPlans.deletedAt),
            eq(trainingPlans.updatedAt, new Date(validInput.replacePlanUpdatedAt ?? '')),
          ),
        )
        .returning({ id: trainingPlans.id });
      if (!replaced) {
        throw new AppError('CONFLICT', 'El plan cambió desde la confirmación. Volvé a intentarlo.');
      }
    }

    const [activePlan] = await tx
      .update(trainingPlans)
      .set({ isActive: true, updatedAt: now })
      .where(
        and(
          eq(trainingPlans.id, plan.id),
          eq(trainingPlans.userId, validInput.userId),
          eq(trainingPlans.isActive, false),
          isNull(trainingPlans.deletedAt),
        ),
      )
      .returning();
    if (!activePlan) {
      throw new AppError('CONFLICT', 'No se pudo activar el plan nuevo. Volvé a intentarlo.');
    }

    if (validInput.mutationId) {
      await tx
        .update(guidedTrainingPlanSaves)
        .set({ trainingPlanId: plan.id })
        .where(
          and(
            eq(guidedTrainingPlanSaves.userId, validInput.userId),
            eq(guidedTrainingPlanSaves.clientMutationId, validInput.mutationId),
          ),
        );
    }

      return { plan: activePlan, schedule };
    })),
  );
}

/**
 * Archives the authenticated user's active plan without deleting its schedule or routines.
 *
 * @param userId - Authenticated owner of the plan.
 * @param planId - Active plan id to finalize.
 * @param input - Mutation id and expected plan version captured before confirmation.
 * @returns The same archived plan and schedule on an identical retry.
 * @throws {AppError} NOT_FOUND for foreign plans, VALIDATION for malformed input, or CONFLICT for stale state or key reuse.
 */
export async function archiveTrainingPlan(
  userId: number,
  planId: number,
  input: unknown,
): Promise<CreateTrainingPlanResult> {
  const parsed = z.object({
    mutationId: z.string().uuid(),
    expectedPlanUpdatedAt: z.string().datetime(),
  }).safeParse(input);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'La confirmación para archivar el plan no es válida.');
  }
  const payloadHash = createHash('sha256')
    .update(JSON.stringify({
      action: 'archive',
      planId,
      expectedPlanUpdatedAt: parsed.data.expectedPlanUpdatedAt,
    }))
    .digest('hex');

  return withUserTrainingPlanWriteLock(
    userId,
    () => withPlanWriteRetries(() => db.transaction(async (tx) => {
    const [claim] = await tx
      .insert(guidedTrainingPlanSaves)
      .values({
        userId,
        clientMutationId: parsed.data.mutationId,
        payloadHash,
      })
      .onConflictDoNothing({
        target: [guidedTrainingPlanSaves.userId, guidedTrainingPlanSaves.clientMutationId],
      })
      .returning({ id: guidedTrainingPlanSaves.id });
    if (!claim) {
      const receipt = await loadPlanSaveReceipt(
        tx,
        userId,
        parsed.data.mutationId,
        payloadHash,
      );
      if (receipt) {
        return receipt;
      }
    }

    const [archived] = await tx
      .update(trainingPlans)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(trainingPlans.id, planId),
          eq(trainingPlans.userId, userId),
          eq(trainingPlans.isActive, true),
          isNull(trainingPlans.deletedAt),
          eq(trainingPlans.updatedAt, new Date(parsed.data.expectedPlanUpdatedAt)),
        ),
      )
      .returning();
    if (!archived) {
      const ownedPlan = await tx
        .select({ id: trainingPlans.id })
        .from(trainingPlans)
        .where(
          and(
            eq(trainingPlans.id, planId),
            eq(trainingPlans.userId, userId),
            isNull(trainingPlans.deletedAt),
          ),
        )
        .limit(1);
      if (ownedPlan.length === 0) {
        throw new AppError('NOT_FOUND', 'Plan no encontrado');
      }
      throw new AppError('CONFLICT', 'El plan cambió antes de archivarse. Volvé a intentarlo.');
    }

    const schedule = await tx
      .select()
      .from(scheduledRoutines)
      .where(eq(scheduledRoutines.trainingPlanId, archived.id))
      .orderBy(asc(scheduledRoutines.dayOfWeek));
    await tx
      .update(guidedTrainingPlanSaves)
      .set({ trainingPlanId: archived.id })
      .where(eq(guidedTrainingPlanSaves.id, claim.id));
      return { plan: archived, schedule };
    })),
  );
}


/**
 * Loads one owned training plan and its weekly schedule.
 *
 * @param userId - Authenticated user id that must own the plan.
 * @param planId - Training plan id from the route parameter.
 * @returns The requested plan and its weekday schedule.
 * @throws {AppError} NOT_FOUND when the plan does not exist, is soft-deleted, or belongs to another user.
 * @example
 * const plan = await getTrainingPlanById(1, 10);
 */
export async function getTrainingPlanById(
  userId: number,
  planId: number,
): Promise<CreateTrainingPlanResult> {
  const plan = await findOwnedTrainingPlan(userId, planId);
  const schedule = await loadPlanSchedule(plan.id);
  const replacementState = await loadTrainingPlanReplacementState(userId, planId);

  return {
    plan,
    schedule,
    replacementStateHash: hashTrainingPlanImprovementValue(replacementState.replacementState),
  };
}

/**
 * Updates an owned weekly training plan and atomically replaces its schedule.
 *
 * @param userId - Authenticated user id that must own the plan.
 * @param planId - Training plan id from the route parameter.
 * @param input - Unknown boundary payload containing name, optional goal, and weekday assignments.
 * @returns The updated plan and its replacement schedule.
 * @throws {AppError} NOT_FOUND when the plan is missing, soft-deleted, or belongs to another user.
 * @throws {AppError} VALIDATION when the payload or referenced routines are invalid.
 * @example
 * await updateTrainingPlan(1, 10, { name: 'Semana', schedule: [{ dayOfWeek: 1, routineId: 7 }] });
 */
export async function updateTrainingPlan(
  userId: number,
  planId: number,
  input: unknown,
): Promise<CreateTrainingPlanResult> {
  const validInput = parseTrainingPlanWriteInput(input);
  const existingPlan = await findOwnedTrainingPlan(userId, planId);
  if (
    !existingPlan.isActive
    || validInput.replacePlanId !== planId
    || validInput.replacePlanUpdatedAt === undefined
    || validInput.replacePlanStateHash === undefined
    || validInput.mutationId === undefined
  ) {
    throw new AppError(
      'CONFLICT',
      'Editar el plan requiere confirmar una nueva versión desde el Plan Hub.',
    );
  }
  return createTrainingPlan({
    userId,
    name: validInput.name,
    goal: validInput.goal,
    schedule: validInput.schedule,
    mutationId: validInput.mutationId,
    replacePlanId: validInput.replacePlanId,
    replacePlanUpdatedAt: validInput.replacePlanUpdatedAt,
    replacePlanStateHash: validInput.replacePlanStateHash,
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

  const dayReason = await buildTodayTrainingPlanDayReason(userId, localDate, plan.goal, now);

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
      dayReason,
    };
  }

  const completion = await getTodayRoutineCompletion(userId, routine.id, now);

  return {
    kind: 'workout',
    localDate,
    dayOfWeek,
    trainingPlanId: plan.id,
    scheduledRoutineId: scheduled.id,
    routineId: routine.id,
    routineName: routine.name,
    planGoal: plan.goal,
    dayReason,
    completion,
  };
}
