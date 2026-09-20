import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { coachAdaptationResultSchema } from '@/lib/ai/coach/adaptation';
import { db } from '@/lib/db/client';
import { coachRecommendations, dailyCheckins, workouts } from '@/lib/db/schema';
import {
  parseCoachResultJson,
  parseJsonValue,
  serializeJsonValue,
} from '@/lib/services/coach-recommendation-json';
import { AppError } from '@/types/errors';
import type { CoachRecommendation } from '@/lib/db/schema';
import type { CoachAdaptationResult, CoachRecommendationSource } from '@/types/coach';

export type CoachRecommendationDecision = 'pending' | 'accepted' | 'rejected';
export type CoachRecommendationFinalDecision = Exclude<CoachRecommendationDecision, 'pending'>;

export interface CoachRecommendationDto {
  id: number;
  userId: number;
  workoutId: number;
  dailyCheckInId: number | null;
  contextSnapshot: unknown | null;
  source: CoachRecommendationSource;
  result: CoachAdaptationResult;
  decision: CoachRecommendationDecision;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const recordCoachRecommendationSchema = z
  .object({
    userId: z.number().int().positive(),
    workoutId: z.number().int().positive(),
    dailyCheckInId: z.number().int().positive().optional(),
    contextSnapshot: z.unknown().optional(),
    source: z.enum(['ai', 'deterministic']),
    result: coachAdaptationResultSchema,
  })
  .strict()
  .refine((input) => input.source === input.result.source, {
    message: 'source must match result.source',
    path: ['source'],
  });

const decideCoachRecommendationSchema = z
  .object({
    id: z.number().int().positive(),
    userId: z.number().int().positive(),
    decision: z.enum(['accepted', 'rejected']),
  })
  .strict();

const getCoachRecommendationSchema = z
  .object({
    id: z.number().int().positive(),
    userId: z.number().int().positive(),
  })
  .strict();

type ValidRecordCoachRecommendationInput = z.infer<typeof recordCoachRecommendationSchema>;
type ValidDecideCoachRecommendationInput = z.infer<typeof decideCoachRecommendationSchema>;
type ValidGetCoachRecommendationInput = z.infer<typeof getCoachRecommendationSchema>;

function parseRecordInput(input: unknown): ValidRecordCoachRecommendationInput {
  const parsed = recordCoachRecommendationSchema.safeParse(input);
  if (!parsed.success) throw new AppError('VALIDATION', 'Recomendación inválida');
  return parsed.data;
}

function parseDecideInput(input: unknown): ValidDecideCoachRecommendationInput {
  const parsed = decideCoachRecommendationSchema.safeParse(input);
  if (!parsed.success) throw new AppError('VALIDATION', 'Decisión inválida');
  return parsed.data;
}

function parseGetInput(input: unknown): ValidGetCoachRecommendationInput {
  const parsed = getCoachRecommendationSchema.safeParse(input);
  if (!parsed.success) throw new AppError('VALIDATION', 'Recomendación inválida');
  return parsed.data;
}

async function assertWorkoutOwnership(workoutId: number, userId: number): Promise<void> {
  const workout = await db.query.workouts.findFirst({
    where: and(eq(workouts.id, workoutId), eq(workouts.userId, userId), isNull(workouts.deletedAt)),
  });
  if (!workout) throw new AppError('NOT_FOUND', 'Entrenamiento no encontrado');
}

async function assertDailyCheckInOwnership(dailyCheckInId: number, userId: number): Promise<void> {
  const checkIn = await db.query.dailyCheckins.findFirst({
    where: and(eq(dailyCheckins.id, dailyCheckInId), eq(dailyCheckins.userId, userId)),
  });
  if (!checkIn) throw new AppError('NOT_FOUND', 'Check-in no encontrado');
}

function toIsoString(value: Date): string {
  return value.toISOString();
}

function parseSource(value: string): CoachRecommendationSource {
  const parsed = z.enum(['ai', 'deterministic']).safeParse(value);
  if (!parsed.success) throw new AppError('VALIDATION', 'Recomendación inválida');
  return parsed.data;
}

function parseDecision(value: string): CoachRecommendationDecision {
  const parsed = z.enum(['pending', 'accepted', 'rejected']).safeParse(value);
  if (!parsed.success) throw new AppError('VALIDATION', 'Recomendación inválida');
  return parsed.data;
}

function toDto(row: CoachRecommendation): CoachRecommendationDto {
  return {
    id: row.id,
    userId: row.userId,
    workoutId: row.workoutId,
    dailyCheckInId: row.dailyCheckInId,
    contextSnapshot: parseJsonValue(row.contextSnapshotJson),
    source: parseSource(row.source),
    result: parseCoachResultJson(row.resultJson),
    decision: parseDecision(row.decision),
    decidedAt: row.decidedAt ? toIsoString(row.decidedAt) : null,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

async function findOwnedRecommendation(id: number, userId: number): Promise<CoachRecommendation | null> {
  const recommendation = await db.query.coachRecommendations.findFirst({
    where: and(eq(coachRecommendations.id, id), eq(coachRecommendations.userId, userId)),
  });
  return recommendation ?? null;
}

/**
 * Persists a generated Coach Atlas recommendation as a pending, traceable preview.
 *
 * Idempotency uses `(workout_id, result_json)`: retrying the same generation returns
 * the existing row and never resets a user decision.
 *
 * @param input Unknown boundary payload with user, workout, source, and result.
 * @returns The pending or pre-existing recommendation DTO.
 * @throws {AppError} VALIDATION for malformed payloads or source/result mismatch.
 * @throws {AppError} NOT_FOUND when workout or check-in ownership fails.
 * @example
 * await recordCoachRecommendation({ userId: 1, workoutId: 10, source: 'ai', result });
 */
export async function recordCoachRecommendation(input: unknown): Promise<CoachRecommendationDto> {
  const validInput = parseRecordInput(input);
  await assertWorkoutOwnership(validInput.workoutId, validInput.userId);
  if (validInput.dailyCheckInId) {
    await assertDailyCheckInOwnership(validInput.dailyCheckInId, validInput.userId);
  }

  const resultJson = serializeJsonValue(validInput.result);
  const contextSnapshotJson =
    validInput.contextSnapshot === undefined ? null : serializeJsonValue(validInput.contextSnapshot);
  const now = new Date();
  const [inserted] = await db
    .insert(coachRecommendations)
    .values({
      userId: validInput.userId,
      workoutId: validInput.workoutId,
      dailyCheckInId: validInput.dailyCheckInId ?? null,
      contextSnapshotJson,
      source: validInput.source,
      resultJson,
      decision: 'pending',
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [coachRecommendations.workoutId, coachRecommendations.resultJson],
    })
    .returning();

  if (inserted) return toDto(inserted);

  const existing = await db.query.coachRecommendations.findFirst({
    where: and(
      eq(coachRecommendations.workoutId, validInput.workoutId),
      eq(coachRecommendations.resultJson, resultJson),
      eq(coachRecommendations.userId, validInput.userId),
    ),
  });
  if (!existing) throw new AppError('CONFLICT', 'No se pudo recuperar la recomendación registrada');
  return toDto(existing);
}

/**
 * Transitions a pending recommendation to accepted or rejected without altering its result.
 *
 * @param input Recommendation id, owner id, and final decision.
 * @returns The decided recommendation DTO.
 * @throws {AppError} VALIDATION when input is invalid.
 * @throws {AppError} NOT_FOUND when the row is missing or foreign.
 * @throws {AppError} CONFLICT when decision is not pending.
 * @example
 * await decideCoachRecommendation({ id: 1, userId: 1, decision: 'accepted' });
 */
export async function decideCoachRecommendation(input: unknown): Promise<CoachRecommendationDto> {
  const validInput = parseDecideInput(input);
  const existing = await findOwnedRecommendation(validInput.id, validInput.userId);
  if (!existing) throw new AppError('NOT_FOUND', 'Recomendación no encontrada');
  if (existing.decision !== 'pending') {
    throw new AppError('CONFLICT', 'La recomendación ya fue decidida');
  }

  const [updated] = await db
    .update(coachRecommendations)
    .set({ decision: validInput.decision, decidedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(coachRecommendations.id, validInput.id), eq(coachRecommendations.decision, 'pending')))
    .returning();

  if (!updated) throw new AppError('CONFLICT', 'La recomendación ya fue decidida');
  return toDto(updated);
}

/**
 * Gets an owned recommendation without leaking whether a foreign row exists.
 *
 * @param input Recommendation id and authenticated user id.
 * @returns The recommendation DTO, or null when absent/foreign.
 * @throws {AppError} VALIDATION when ids are invalid.
 * @example
 * const recommendation = await getCoachRecommendation({ id: 1, userId: 1 });
 */
export async function getCoachRecommendation(input: unknown): Promise<CoachRecommendationDto | null> {
  const validInput = parseGetInput(input);
  const recommendation = await findOwnedRecommendation(validInput.id, validInput.userId);
  return recommendation ? toDto(recommendation) : null;
}
