import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db/client';
import { postWorkoutFeedback, workouts } from '@/lib/db/schema';
import { cordobaLocalDate } from '@/lib/time/cordoba';
import { AppError } from '@/types/errors';
import { metric } from '@/types/metric';
import type { PostWorkoutFeedback } from '@/lib/db/schema';
import type { Metric } from '@/types/metric';

export const POST_WORKOUT_FEEDBACK_NOTE_MAX_LENGTH = 500;
export const POST_WORKOUT_FEEDBACK_DISCOMFORT_MAX_ENTRIES = 5;

export type WorkoutSensation = 'great' | 'good' | 'neutral' | 'hard' | 'bad';
export type DiscomfortIntensity = 'mild' | 'moderate' | 'strong';
export type DiscomfortArea =
  | 'neck'
  | 'shoulder'
  | 'elbow'
  | 'wrist'
  | 'back'
  | 'hip'
  | 'knee'
  | 'ankle'
  | 'other';

export interface DiscomfortEntry {
  area: DiscomfortArea;
  intensity: DiscomfortIntensity;
}

export interface PostWorkoutFeedbackDto {
  id: number;
  workoutId: number;
  localDate: string;
  effort: Metric<number>;
  sensation: Metric<WorkoutSensation>;
  discomfort: Metric<DiscomfortEntry[]>;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

const discomfortEntrySchema = z.object({
  area: z.enum(['neck', 'shoulder', 'elbow', 'wrist', 'back', 'hip', 'knee', 'ankle', 'other']),
  intensity: z.enum(['mild', 'moderate', 'strong']),
});

const sensationSchema = z.enum(['great', 'good', 'neutral', 'hard', 'bad']);

const recordPostWorkoutFeedbackSchema = z
  .object({
    userId: z.number().int().positive(),
    workoutId: z.number().int().positive(),
    effort: z.number().int().min(1).max(10),
    sensation: sensationSchema,
    discomfort: z.array(discomfortEntrySchema).max(POST_WORKOUT_FEEDBACK_DISCOMFORT_MAX_ENTRIES),
    note: z.string().max(POST_WORKOUT_FEEDBACK_NOTE_MAX_LENGTH).nullable().optional(),
  })
  .strict();

const getPostWorkoutFeedbackSchema = z.object({
  workoutId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

type ValidRecordPostWorkoutFeedbackInput = z.infer<typeof recordPostWorkoutFeedbackSchema>;

function parseRecordPostWorkoutFeedbackInput(input: unknown): ValidRecordPostWorkoutFeedbackInput {
  const parsed = recordPostWorkoutFeedbackSchema.safeParse(input);

  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Feedback post-entrenamiento inválido');
  }

  return parsed.data;
}

function parseDiscomfortJson(value: string): DiscomfortEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new AppError('VALIDATION', 'Feedback post-entrenamiento inválido');
  }

  const result = z.array(discomfortEntrySchema).safeParse(parsed);

  if (!result.success) {
    throw new AppError('VALIDATION', 'Feedback post-entrenamiento inválido');
  }

  return result.data;
}

function toIsoString(value: Date): string {
  return value.toISOString();
}

function parseStoredSensation(value: string): WorkoutSensation {
  const parsed = sensationSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Feedback post-entrenamiento inválido');
  }

  return parsed.data;
}

function toPostWorkoutFeedbackDto(row: PostWorkoutFeedback): PostWorkoutFeedbackDto {
  return {
    id: row.id,
    workoutId: row.workoutId,
    localDate: row.localDate,
    effort: metric(row.effort, 'user_input'),
    sensation: metric(parseStoredSensation(row.sensation), 'user_input'),
    discomfort: metric(parseDiscomfortJson(row.discomfortJson), 'user_input'),
    note: row.note,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

async function findCompletedWorkoutForFeedback(workoutId: number, userId: number): Promise<Date> {
  const workout = await db.query.workouts.findFirst({
    where: and(eq(workouts.id, workoutId), eq(workouts.userId, userId), isNull(workouts.deletedAt)),
  });

  if (!workout) {
    throw new AppError('NOT_FOUND', 'Entrenamiento no encontrado');
  }

  if (!workout.endedAt) {
    throw new AppError('VALIDATION', 'El entrenamiento debe estar finalizado');
  }

  return workout.endedAt;
}

/**
 * Records explicit post-workout feedback for a completed workout, upserting one row per workout.
 *
 * @param input - Unknown boundary payload validated with Zod before persistence.
 * @returns The feedback DTO with every user-facing metric marked as user_input.
 * @throws {AppError} VALIDATION when input is invalid or the workout is still open.
 * @throws {AppError} NOT_FOUND when the workout does not belong to the user.
 * @example
 * await recordPostWorkoutFeedback({ userId: 1, workoutId: 10, effort: 7, sensation: 'good', discomfort: [] });
 */
export async function recordPostWorkoutFeedback(input: unknown): Promise<PostWorkoutFeedbackDto> {
  const validInput = parseRecordPostWorkoutFeedbackInput(input);
  const endedAt = await findCompletedWorkoutForFeedback(validInput.workoutId, validInput.userId);
  const localDate = cordobaLocalDate(endedAt);
  const now = new Date();

  const [feedback] = await db
    .insert(postWorkoutFeedback)
    .values({
      userId: validInput.userId,
      workoutId: validInput.workoutId,
      localDate,
      effort: validInput.effort,
      sensation: validInput.sensation,
      discomfortJson: JSON.stringify(validInput.discomfort),
      note: validInput.note ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: postWorkoutFeedback.workoutId,
      set: {
        localDate,
        effort: validInput.effort,
        sensation: validInput.sensation,
        discomfortJson: JSON.stringify(validInput.discomfort),
        note: validInput.note ?? null,
        updatedAt: now,
      },
    })
    .returning();

  return toPostWorkoutFeedbackDto(feedback);
}

/**
 * Gets post-workout feedback for a workout owned by the user.
 *
 * @param workoutId - Completed workout id.
 * @param userId - Authenticated user id.
 * @returns The feedback DTO, or null when the owned workout has no feedback yet.
 * @throws {AppError} VALIDATION when ids are invalid.
 * @throws {AppError} NOT_FOUND when the workout does not belong to the user.
 * @example
 * const feedback = await getPostWorkoutFeedback(10, 1);
 */
export async function getPostWorkoutFeedback(
  workoutId: number,
  userId: number,
): Promise<PostWorkoutFeedbackDto | null> {
  const parsed = getPostWorkoutFeedbackSchema.safeParse({ workoutId, userId });
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Feedback post-entrenamiento inválido');
  }

  await findCompletedWorkoutForFeedback(parsed.data.workoutId, parsed.data.userId);

  const feedback = await db.query.postWorkoutFeedback.findFirst({
    where: and(
      eq(postWorkoutFeedback.workoutId, parsed.data.workoutId),
      eq(postWorkoutFeedback.userId, parsed.data.userId),
    ),
  });

  return feedback ? toPostWorkoutFeedbackDto(feedback) : null;
}
