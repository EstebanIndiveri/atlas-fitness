import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { archiveTrainingPlan } from '@/lib/services/training-plan';
import { AppError } from '@/types/errors';

function parsePlanId(id: string): number {
  if (!/^[1-9]\d*$/.test(id)) {
    throw new AppError('VALIDATION', 'ID de plan inválido');
  }
  return Number(id);
}

/**
 * POST /api/training-plan/[id]/archive — finalizes an active owned plan without deleting history.
 *
 * @param request - Authenticated request containing the confirmed mutation id and plan version.
 * @param context - Dynamic route params containing the plan id.
 * @returns The inactive plan and its unchanged schedule.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const input: unknown = await request.json();
    const result = await archiveTrainingPlan(session.userId, parsePlanId(id), input);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'La confirmación para archivar el plan no es válida.' },
        { status: 400 },
      );
    }
    return handleApiError(error);
  }
}
