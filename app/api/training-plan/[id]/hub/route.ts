import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { getTrainingPlanHub } from '@/lib/services/training-plan-hub';
import { AppError } from '@/types/errors';

function parsePlanId(id: string): number {
  if (!/^[1-9]\d*$/.test(id)) {
    throw new AppError('VALIDATION', 'ID de plan inválido');
  }

  const planId = Number(id);
  if (!Number.isSafeInteger(planId)) {
    throw new AppError('VALIDATION', 'ID de plan inválido');
  }

  return planId;
}

/**
 * GET /api/training-plan/[id]/hub — returns an owned plan's full weekly read model.
 *
 * @param request - Authenticated request.
 * @param context - Dynamic route params containing the plan id.
 * @returns The plan header and seven ordered day assignments.
 * @throws {AppError} UNAUTHORIZED, VALIDATION, or NOT_FOUND for invalid access.
 * @example
 * await GET(request, { params: Promise.resolve({ id: '10' }) });
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const hub = await getTrainingPlanHub(session.userId, parsePlanId(id));
    return NextResponse.json(hub);
  } catch (error) {
    return handleApiError(error);
  }
}
