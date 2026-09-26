import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import {
  completeUserOnboarding,
  getUserOnboardingState,
} from '@/lib/services/user-onboarding';
import type { CompleteUserOnboardingInput } from '@/lib/services/user-onboarding';
import { AppError } from '@/types/errors';

const answersSchema = z.object({
  goal: z.string().nullable(),
  pace: z.string().nullable(),
  equipment: z.string().nullable(),
}).strict();

const onboardingActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('skip') }).strict(),
  z.object({ action: z.literal('finish'), answers: answersSchema }).strict(),
]);

async function readAction(request: NextRequest): Promise<CompleteUserOnboardingInput> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError('VALIDATION', 'Acción de onboarding inválida');
  }

  const parsed = onboardingActionSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('VALIDATION', 'Acción de onboarding inválida');
  }
  return parsed.data;
}

/**
 * GET /api/profile/onboarding — returns completion state for the authenticated account.
 *
 * @param request - Request carrying the authenticated session cookie.
 * @returns The account's persisted completion state.
 * @example await GET(request);
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const state = await getUserOnboardingState(session.userId);
    return NextResponse.json(state);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/profile/onboarding — persists Finish or Skip for the authenticated account.
 *
 * @param request - Request carrying the authenticated session and onboarding action.
 * @returns The completed state after the action is committed.
 * @example await POST(request);
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const action = await readAction(request);
    const state = await completeUserOnboarding(session.userId, action);
    return NextResponse.json(state);
  } catch (error) {
    return handleApiError(error);
  }
}
