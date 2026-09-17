import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import * as statsService from '@/lib/services/stats';
import { AppError } from '@/types/errors';

/**
 * GET /api/stats/exercise/[id]/history - Get exercise history for a specific exercise
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = requireAuth(request);
    const { id } = await params;
    const exerciseId = parseInt(id);

    if (isNaN(exerciseId)) {
      throw new AppError('VALIDATION', 'ID de ejercicio inválido');
    }

    const history = await statsService.getExerciseHistory(exerciseId, session.userId);

    return NextResponse.json(history);
  } catch (error) {
    return handleApiError(error);
  }
}
