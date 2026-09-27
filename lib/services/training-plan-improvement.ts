import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { generateWeeklyPlanDraft } from '@/lib/ai/weekly-plan-draft';
import { db } from '@/lib/db/client';
import { guidedTrainingPlanSaves } from '@/lib/db/schema';
import { trainingPlanImprovementIntentSchema } from '@/lib/services/training-plan-improvement-input';
import { hashTrainingPlanImprovementValue } from '@/lib/services/training-plan-improvement-hash';
import {
  createTrainingPlanImprovementReceipt,
  verifyTrainingPlanImprovementReceipt,
} from '@/lib/services/training-plan-improvement-receipt';
import {
  assertTrainingPlanReplacementStateMatchesHub,
  loadTrainingPlanReplacementState,
} from '@/lib/services/training-plan-improvement-state';
import { listExercises } from '@/lib/services/exercises';
import { getRoutineById } from '@/lib/services/routines';
import { createGuidedTrainingPlan } from '@/lib/services/guided-training-plan';
import { getTrainingPlanHub } from '@/lib/services/training-plan-hub';
import type { RoutineKind } from '@/types/routine';
import type {
  TrainingPlanImprovementProposal,
  TrainingPlanImprovementSnapshot,
} from '@/types/training-plan-improvement';
import type { TrainingPlanHubDto } from '@/types/training-plan-hub';
import { AppError } from '@/types/errors';

const dayOfWeekSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

const intentSchema = trainingPlanImprovementIntentSchema;
const improvementRequestSchema = z.object({ intent: intentSchema });
const proposalExerciseSchema = z.object({
  exerciseId: z.number().int().positive(),
  exerciseName: z.string().trim().min(1).max(100),
  muscleGroup: z.string().trim().min(1).max(60),
  sortOrder: z.number().int().min(0).max(29),
  targetSets: z.number().int().min(1).max(8),
  targetReps: z.number().int().min(1).max(30),
});
const weeklyPlanProposalSchema = z.object({
  source: z.enum(['gemini', 'fallback']),
  name: z.string().trim().min(2).max(80),
  goal: intentSchema,
  days: z
    .array(
      z.object({
        dayOfWeek: dayOfWeekSchema,
        title: z.string().trim().min(2).max(60),
        focus: z.string().trim().min(2).max(80),
        exercises: z.array(proposalExerciseSchema).min(1).max(30),
      }),
    )
    .min(1)
    .max(7),
});
const confirmationSchema = z.object({
  mutationId: z.string().uuid(),
  intent: intentSchema,
  expectedPlanUpdatedAt: z.string().datetime(),
  confirmationToken: z.string().min(1).max(20_000),
  proposal: weeklyPlanProposalSchema,
});

type ValidatedConfirmation = z.infer<typeof confirmationSchema>;

/**
 * Creates a non-persistent improvement proposal from an owned active weekly plan.
 *
 * @param userId - Authenticated plan owner.
 * @param planId - Persisted active weekly plan id.
 * @param input - Untrusted request containing the user's explicit improvement intent.
 * @returns The server-authored current-plan snapshot and a reviewable proposal.
 * @throws {AppError} VALIDATION for invalid intent or unsupported plan frequency, NOT_FOUND for inaccessible plans, or CONFLICT for inactive plans.
 * @example
 * await generateTrainingPlanImprovementProposal(1, 12, { intent: 'Reducir volumen' });
 */
export async function generateTrainingPlanImprovementProposal(
  userId: number,
  planId: number,
  input: unknown,
): Promise<TrainingPlanImprovementProposal> {
  const parsed = improvementRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Escribí qué querés mejorar (entre 2 y 60 caracteres).');
  }

  const hub = await getTrainingPlanHub(userId, planId);
  assertPlanIsActive(hub);
  const currentPlan = await loadImprovementSnapshot(userId, hub);
  const source = await loadTrainingPlanReplacementState(userId, planId);
  assertTrainingPlanReplacementStateMatchesHub(hub, source);
  const trainingDays = currentPlan.days.filter(({ assignment }) => assignment.kind !== 'rest');
  if (trainingDays.length === 0) {
    throw new AppError('VALIDATION', 'El plan no tiene días de entrenamiento para mejorar.');
  }

  const catalog = await listExercises(userId);
  if (catalog.length === 0) {
    throw new AppError('VALIDATION', 'No hay ejercicios disponibles para armar una propuesta.');
  }

  const routineAssignments = currentPlan.days.flatMap(({ assignment }) =>
    assignment.kind === 'routine' ? [assignment] : [],
  );
  const availableEquipment = [...new Set(
    routineAssignments.map(({ routineKind }) =>
      routineKind === 'gym' ? 'gimnasio completo' : 'entrenamiento en casa',
    ),
  )];
  const focusAreas = [...new Set(
    routineAssignments.map(({ focus, routineName }) => focus?.trim() || routineName),
  )].slice(0, 6);
  const proposal = await generateWeeklyPlanDraft({
    goal: parsed.data.intent,
    daysPerWeek: trainingDays.length,
    experience: 'intermediate',
    availableEquipment,
    sessionLengthMinutes: 55,
    focusAreas,
    catalog,
    currentPlan: toGeneratorContext(currentPlan),
  });

  const routineKinds = currentPlan.days.flatMap(({ assignment }) =>
    assignment.kind === 'routine' ? [assignment.routineKind] : [],
  );
  const defaultRoutineKind = mostCommonRoutineKind(routineKinds);
  const routineKindsByDay = proposal.days.map(({ dayOfWeek }) => {
    const assignment = currentPlan.days.find((day) => day.dayOfWeek === dayOfWeek)?.assignment;
    return {
      dayOfWeek,
      kind: assignment?.kind === 'routine' ? assignment.routineKind : defaultRoutineKind,
    };
  });
  const intent = parsed.data.intent;
  const confirmationToken = createTrainingPlanImprovementReceipt({
    version: 1,
    userId,
    planId,
    intent,
    expectedPlanUpdatedAt: hub.plan.updatedAt,
    currentPlanHash: hashTrainingPlanImprovementValue(currentPlan),
    proposalHash: hashTrainingPlanImprovementValue(proposal),
    replacePlanStateHash: hashTrainingPlanImprovementValue(source.replacementState),
    routineKindsByDay,
    defaultRoutineKind,
  });

  return {
    intent,
    currentPlan,
    proposal,
    confirmationToken,
  };
}

/**
 * Atomically and idempotently replaces the same active plan that produced a confirmed proposal.
 *
 * @param userId - Authenticated plan owner.
 * @param planId - Path plan id captured when the proposal was generated.
 * @param input - Confirmation, proposal, and expected plan version.
 * @returns The newly persisted plan and schedule, or the same result on an identical retry.
 * @throws {AppError} VALIDATION for malformed confirmation, CONFLICT for stale plan state or mutation reuse, and NOT_FOUND for inaccessible exercises/plans.
 * @example
 * await confirmTrainingPlanImprovement(1, 12, confirmation);
 */
export async function confirmTrainingPlanImprovement(
  userId: number,
  planId: number,
  input: unknown,
): Promise<Awaited<ReturnType<typeof createGuidedTrainingPlan>>> {
  const confirmation = parseConfirmation(input);
  const receipt = verifyTrainingPlanImprovementReceipt(confirmation.confirmationToken);
  if (
    receipt.userId !== userId
    || receipt.planId !== planId
    || receipt.intent !== confirmation.intent
    || receipt.expectedPlanUpdatedAt !== confirmation.expectedPlanUpdatedAt
    || receipt.proposalHash !== hashTrainingPlanImprovementValue(confirmation.proposal)
  ) {
    throw new AppError('CONFLICT', 'La propuesta no es válida para este plan.');
  }

  const [existingSave] = await db
    .select({ trainingPlanId: guidedTrainingPlanSaves.trainingPlanId })
    .from(guidedTrainingPlanSaves)
    .where(
      and(
        eq(guidedTrainingPlanSaves.userId, userId),
        eq(guidedTrainingPlanSaves.clientMutationId, confirmation.mutationId),
      ),
    )
    .limit(1);
  const isIdenticalRetry = existingSave?.trainingPlanId !== null
    && existingSave?.trainingPlanId !== undefined;

  if (!isIdenticalRetry) {
    const hub = await getTrainingPlanHub(userId, planId);
    assertPlanIsActive(hub);
    const currentPlan = await loadImprovementSnapshot(userId, hub);
    if (hashTrainingPlanImprovementValue(currentPlan) !== receipt.currentPlanHash) {
      throw new AppError(
        'CONFLICT',
        'El plan cambió desde que se generó la propuesta. Generá una nueva.',
      );
    }
    const source = await loadTrainingPlanReplacementState(userId, planId);
    assertTrainingPlanReplacementStateMatchesHub(hub, source);
    if (
      hashTrainingPlanImprovementValue(source.replacementState)
      !== receipt.replacePlanStateHash
    ) {
      throw new AppError(
        'CONFLICT',
        'El plan cambió desde que se generó la propuesta. Generá una nueva.',
      );
    }
  }

  const kindsByDay = new Map(receipt.routineKindsByDay.map(({ dayOfWeek, kind }) => [
    dayOfWeek,
    kind,
  ]));
  const days = confirmation.proposal.days.map((day) => {
    return {
      dayOfWeek: day.dayOfWeek,
      note: `${day.title} · ${day.focus}`.slice(0, 140),
      routine: {
        name: `Coach Atlas · ${day.title} · ${day.focus}`.slice(0, 200),
        description: `Rutina propuesta para ${day.focus}.`,
        kind: kindsByDay.get(day.dayOfWeek) ?? receipt.defaultRoutineKind,
        restSeconds: 120,
        exercises: day.exercises.map(({ exerciseId, sortOrder, targetSets, targetReps }) => ({
          exerciseId,
          sortOrder,
          targetSets,
          targetReps,
        })),
      },
    };
  });

  return createGuidedTrainingPlan(userId, {
    mutationId: confirmation.mutationId,
    name: confirmation.proposal.name,
    goal: confirmation.intent,
    replacePlanId: planId,
    replacePlanUpdatedAt: confirmation.expectedPlanUpdatedAt,
    replacePlanStateHash: receipt.replacePlanStateHash,
    days,
  });
}

async function loadImprovementSnapshot(
  userId: number,
  hub: TrainingPlanHubDto,
): Promise<TrainingPlanImprovementSnapshot> {
  const routineIds = [...new Set(
    hub.days.flatMap(({ assignment }) =>
      assignment.kind === 'routine' ? [assignment.routineId] : [],
    ),
  )];
  const routines = await Promise.all(
    routineIds.map((routineId) => getRoutineById(routineId, userId, hub.plan.id)),
  );
  const routinesById = new Map(routines.map((routine) => [routine.id, routine]));

  return {
    plan: hub.plan,
    days: hub.days.map(({ dayOfWeek, assignment }) => ({
      dayOfWeek,
      assignment: assignment.kind === 'routine'
        ? {
            ...assignment,
            exercises: (routinesById.get(assignment.routineId)?.exercises ?? []).map((exercise) => ({
              exerciseId: exercise.exerciseId,
              exerciseName: exercise.exerciseName,
              targetSets: exercise.targetSets,
              targetReps: exercise.targetReps,
            })),
          }
        : assignment,
    })),
  };
}

function toGeneratorContext(currentPlan: TrainingPlanImprovementSnapshot) {
  return {
    name: currentPlan.plan.name,
    goal: currentPlan.plan.goal,
    days: currentPlan.days.map(({ dayOfWeek, assignment }) => ({
      dayOfWeek,
      kind: assignment.kind,
      ...(assignment.kind === 'routine'
        ? {
            routineName: assignment.routineName,
            focus: assignment.focus,
            exercises: assignment.exercises,
          }
        : {}),
    })),
  };
}

function parseConfirmation(input: unknown): ValidatedConfirmation {
  const parsed = confirmationSchema.safeParse(input);
  if (!parsed.success || parsed.data.proposal.goal !== parsed.data.intent) {
    throw new AppError('VALIDATION', 'La confirmación de la propuesta no es válida.');
  }

  const weekdays = parsed.data.proposal.days.map(({ dayOfWeek }) => dayOfWeek);
  if (new Set(weekdays).size !== weekdays.length) {
    throw new AppError('VALIDATION', 'La propuesta no puede repetir días.');
  }
  for (const day of parsed.data.proposal.days) {
    const sortOrders = day.exercises.map(({ sortOrder }) => sortOrder);
    if (new Set(sortOrders).size !== sortOrders.length) {
      throw new AppError('VALIDATION', 'El orden de los ejercicios no puede repetirse.');
    }
  }

  return parsed.data;
}

function assertPlanIsActive(hub: TrainingPlanHubDto): void {
  if (!hub.plan.isActive) {
    throw new AppError('CONFLICT', 'Solo podés mejorar tu plan semanal activo.');
  }
}

function mostCommonRoutineKind(kinds: readonly RoutineKind[]): RoutineKind {
  const gymCount = kinds.filter((kind) => kind === 'gym').length;
  const homeCount = kinds.length - gymCount;
  return gymCount > homeCount ? 'gym' : 'home';
}
