import { createHash } from 'node:crypto';
import { z } from 'zod';

import { AppError } from '@/types/errors';

const exerciseSchema = z.object({
  exerciseId: z.number().int().positive(),
  sortOrder: z.number().int().min(0),
  targetSets: z.number().int().positive(),
  targetReps: z.number().int().positive(),
});

const routineSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(500).nullable().optional(),
  kind: z.enum(['gym', 'home']),
  restSeconds: z.number().int().min(0).max(3600),
  exercises: z.array(exerciseSchema).min(1).max(30),
});

export const guidedTrainingPlanSchema = z.object({
  mutationId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(60).optional(),
  replacePlanId: z.number().int().positive().optional(),
  replacePlanUpdatedAt: z.string().datetime().optional(),
  replacePlanStateHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  days: z
    .array(
      z.object({
        dayOfWeek: z.union([
          z.literal(0),
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
          z.literal(5),
          z.literal(6),
        ]),
        note: z.string().trim().min(1).max(140).optional(),
        routine: routineSchema,
      }),
    )
    .min(1)
    .max(7),
}).refine(
  (value) => {
    const replacementFields = [
      value.replacePlanId,
      value.replacePlanUpdatedAt,
      value.replacePlanStateHash,
    ];
    const providedFields = replacementFields.filter((field) => field !== undefined).length;
    return providedFields === 0 || providedFields === replacementFields.length;
  },
  { message: 'La versión del plan a reemplazar es inválida' },
);

export type ValidGuidedTrainingPlan = z.infer<typeof guidedTrainingPlanSchema>;

/**
 * Validates and normalizes an untrusted guided-plan save payload.
 *
 * @param input - JSON payload received by the guided-save API.
 * @returns The validated plan with unknown fields stripped.
 * @throws {AppError} VALIDATION when the payload or its day/exercise ordering is invalid.
 * @example
 * const valid = parseGuidedTrainingPlan({ mutationId, name: 'Semana', days });
 */
export function parseGuidedTrainingPlan(input: unknown): ValidGuidedTrainingPlan {
  const parsed = guidedTrainingPlanSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Propuesta semanal inválida');
  }

  const days = new Set(parsed.data.days.map(({ dayOfWeek }) => dayOfWeek));
  if (days.size !== parsed.data.days.length) {
    throw new AppError('VALIDATION', 'El plan no puede repetir días');
  }

  for (const { routine } of parsed.data.days) {
    const sortOrders = new Set(routine.exercises.map(({ sortOrder }) => sortOrder));
    if (sortOrders.size !== routine.exercises.length) {
      throw new AppError('VALIDATION', 'El orden de los ejercicios no puede repetirse');
    }
  }

  return parsed.data;
}

/**
 * Computes the stable SHA-256 fingerprint used to reject mutation-ID payload changes.
 *
 * @param input - Validated plan data without relying on user-supplied ownership fields.
 * @returns A lowercase hexadecimal hash of the normalized plan payload.
 * @example
 * const fingerprint = hashGuidedPlanPayload(validPlan);
 */
export function hashGuidedPlanPayload(input: ValidGuidedTrainingPlan): string {
  const canonicalPayload = {
    name: input.name,
    goal: input.goal ?? null,
    days: input.days,
    ...(input.replacePlanId === undefined
      ? {}
      : {
          replacePlanId: input.replacePlanId,
          replacePlanUpdatedAt: input.replacePlanUpdatedAt,
          replacePlanStateHash: input.replacePlanStateHash,
        }),
  };

  return createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');
}
