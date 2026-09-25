import { createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';

import { resolveSessionSecret } from '@/lib/auth/session-secret';
import { timingSafeEqualHex } from '@/lib/auth/session-payload';
import { trainingPlanImprovementIntentSchema } from '@/lib/services/training-plan-improvement-input';
import { canonicalTrainingPlanImprovementJson } from '@/lib/services/training-plan-improvement-hash';
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
const routineKindSchema = z.enum(['gym', 'home']);
const receiptClaimsSchema = z.object({
  version: z.literal(1),
  nonce: z.string().uuid(),
  expiresAt: z.string().datetime(),
  userId: z.number().int().positive(),
  planId: z.number().int().positive(),
  intent: trainingPlanImprovementIntentSchema,
  expectedPlanUpdatedAt: z.string().datetime(),
  currentPlanHash: z.string().regex(/^[0-9a-f]{64}$/),
  proposalHash: z.string().regex(/^[0-9a-f]{64}$/),
  replacePlanStateHash: z.string().regex(/^[0-9a-f]{64}$/),
  routineKindsByDay: z.array(
    z.object({ dayOfWeek: dayOfWeekSchema, kind: routineKindSchema }),
  ).min(1).max(7),
  defaultRoutineKind: routineKindSchema,
});

export type TrainingPlanImprovementReceiptClaims = z.infer<typeof receiptClaimsSchema>;
type NewReceiptClaims = Omit<TrainingPlanImprovementReceiptClaims, 'nonce' | 'expiresAt'>;

const RECEIPT_TTL_MILLISECONDS = 60 * 60 * 1000;

/**
 * Creates an HMAC-protected receipt binding an issued proposal to its authenticated source plan.
 *
 * @param claims - User, plan version, normalized intent, proposal fingerprint, and exact source state.
 * @returns Opaque base64url payload and hexadecimal HMAC.
 */
export function createTrainingPlanImprovementReceipt(
  input: NewReceiptClaims,
): string {
  const claims = receiptClaimsSchema.parse({
    ...input,
    nonce: randomUUID(),
    expiresAt: new Date(Date.now() + RECEIPT_TTL_MILLISECONDS).toISOString(),
  });
  const payload = Buffer.from(canonicalTrainingPlanImprovementJson(claims)).toString('base64url');
  const signature = createHmac('sha256', resolveSessionSecret())
    .update(`atlas-plan-improvement:v1:${payload}`)
    .digest('hex');
  return `${payload}.${signature}`;
}

/**
 * Verifies and parses a proposal receipt before accepting a client confirmation.
 *
 * @param token - Opaque receipt returned by the proposal endpoint.
 * @returns Validated claims after constant-time signature comparison.
 * @throws {AppError} CONFLICT when the receipt is malformed or its signature is invalid.
 */
export function verifyTrainingPlanImprovementReceipt(
  token: string,
): TrainingPlanImprovementReceiptClaims {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) {
    throw invalidReceipt();
  }

  const expectedSignature = createHmac('sha256', resolveSessionSecret())
    .update(`atlas-plan-improvement:v1:${payload}`)
    .digest('hex');
  if (!timingSafeEqualHex(expectedSignature, signature)) {
    throw invalidReceipt();
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw invalidReceipt();
  }
  const parsed = receiptClaimsSchema.safeParse(decoded);
  if (!parsed.success || Date.parse(parsed.data.expiresAt) <= Date.now()) {
    throw invalidReceipt();
  }
  return parsed.data;
}

function invalidReceipt(): AppError {
  return new AppError('CONFLICT', 'La propuesta no es válida para este plan.');
}
