import { z } from 'zod';

const trainingPlanDayOfWeekSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

const trainingPlanHubAssignmentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rest') }),
  z.object({
    kind: z.literal('routine'),
    routineId: z.number().int().positive(),
    routineName: z.string(),
    routineDescription: z.string().nullable(),
    routineKind: z.enum(['gym', 'home']),
    focus: z.string().nullable(),
  }),
  z.object({ kind: z.literal('unavailable') }),
]);

export const trainingPlanHubDtoSchema = z.object({
  plan: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    goal: z.string().nullable(),
    isActive: z.boolean(),
    updatedAt: z.string().datetime(),
  }),
  days: z
    .array(
      z.object({
        dayOfWeek: trainingPlanDayOfWeekSchema,
        assignment: trainingPlanHubAssignmentSchema,
      }),
    )
    .length(7),
});

export type TrainingPlanHubDto = z.infer<typeof trainingPlanHubDtoSchema>;
