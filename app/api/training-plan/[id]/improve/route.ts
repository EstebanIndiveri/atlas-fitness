import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { enforceWeeklyPlanGenerateRateLimit } from '@/lib/auth/weekly-plan-rate-limit';
import { parseTrainingPlanId } from '@/lib/api/training-plan-id';
import { generateTrainingPlanImprovementProposal } from '@/lib/services/training-plan-improvement';
import { AppError } from '@/types/errors';

/**
 * POST /api/training-plan/[id]/improve — creates a non-persistent proposal from an active plan.
 *
 * @param request - Authenticated request with the user's explicit improvement intent.
 * @param context - Dynamic route params containing the selected plan id.
 * @returns A server-authored current-plan snapshot and a generated proposal.
 * @throws {AppError} UNAUTHORIZED, VALIDATION, NOT_FOUND, or CONFLICT for invalid access or input.
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
      throw new AppError('VALIDATION', 'Objetivo de mejora inválido');
    }

    await enforceWeeklyPlanGenerateRateLimit(request, session.userId);
    const proposal = await generateTrainingPlanImprovementProposal(
      session.userId,
      planId,
      input,
    );
    return NextResponse.json(proposal);
  } catch (error) {
    return handleApiError(error);
  }
}
