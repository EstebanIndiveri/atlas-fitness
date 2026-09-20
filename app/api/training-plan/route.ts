import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { createTrainingPlan } from '@/lib/services/training-plan';
import { AppError } from '@/types/errors';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonObjectBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      throw new AppError('VALIDATION', 'Plan inválido');
    }
    return body;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('VALIDATION', 'Plan inválido');
  }
}

/**
 * POST /api/training-plan — creates the authenticated user's weekly training plan.
 *
 * @param request - Next.js request with authenticated session cookie and JSON plan payload.
 * @returns JSON response containing the created training plan and schedule.
 * @throws {AppError} VALIDATION when JSON is malformed or the service rejects the payload.
 * @example
 * await POST(request);
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const body = await readJsonObjectBody(request);
    const result = await createTrainingPlan({ ...body, userId: session.userId });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
