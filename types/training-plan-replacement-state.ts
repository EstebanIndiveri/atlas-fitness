import { z } from 'zod';

const dayOfWeekSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);
const routineKindSchema = z.enum(['gym', 'home']);

export const trainingPlanReplacementStateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  goal: z.string().max(60).nullable(),
  schedule: z
    .array(
      z.object({
        dayOfWeek: dayOfWeekSchema,
        routineId: z.number().int().positive(),
        note: z.string().max(140).nullable(),
      }),
    )
    .max(7),
  routines: z
    .array(
      z.object({
        id: z.number().int().positive(),
        slug: z.string().min(1).max(2_000),
        name: z.string().min(1).max(200),
        description: z.string().max(10_000).nullable(),
        kind: routineKindSchema,
        restSeconds: z.number().int().min(0).max(3600),
        isSystem: z.boolean(),
        userId: z.number().int().positive().nullable(),
        deletedAt: z.string().datetime().nullable(),
        exercises: z
          .array(
            z.object({
              exerciseId: z.number().int().positive(),
              sortOrder: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
              targetSets: z.number().int().positive(),
              targetReps: z.number().int().positive(),
              isSystem: z.boolean(),
              userId: z.number().int().positive().nullable(),
              exerciseName: z.string().min(1).max(200),
              muscleGroup: z.string().min(1).max(200),
              instructions: z.string().max(20_000),
              imageUrl: z.string().max(2_000).nullable(),
              videoUrl: z.string().max(2_000).nullable(),
            }),
          )
          .max(30),
      }),
    )
    .max(7),
});

export type TrainingPlanReplacementState = z.infer<
  typeof trainingPlanReplacementStateSchema
>;
