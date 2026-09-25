import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { parseTrainingPlanId } from '@/lib/api/training-plan-id';
import { confirmTrainingPlanImprovement } from '@/lib/services/training-plan-improvement';
import { AppError } from '@/types/errors';

/**
 * POST /api/training-plan/[id]/improve/confirm — persists an explicitly accepted proposal.
 *
 * @param request - Authenticated request containing the accepted proposal and idempotency key.
 * @param context - Dynamic route params containing the source plan id.
 * @returns The newly active plan and its weekly assignments.
 * @throws {AppError} UNAUTHORIZED, VALIDATION, NOT_FOUND, or CONFLICT for invalid access or stale state.
 * @example
 * await POST(request, { params: Promise.resolve({ id: '12' }) });
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const planId = parseTrainingPlanId(id);
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw new AppError('VALIDATION', 'Confirmación de la propuesta inválida');
    }

    const result = await confirmTrainingPlanImprovement(session.userId, planId, input);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
