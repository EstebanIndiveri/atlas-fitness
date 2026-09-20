import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { getGuidedCloseSummary } from '@/lib/services/guided-session';
import { AppError } from '@/types/errors';

/**
 * GET /api/workouts/[id]/close-summary
 * Streak + max-weight delta vs last session of the same exercise.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const workoutId = parseInt(id, 10);
    if (Number.isNaN(workoutId)) {
      throw new AppError('VALIDATION', 'ID de entrenamiento inválido');
    }

    const summary = await getGuidedCloseSummary(workoutId, session.userId);
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
