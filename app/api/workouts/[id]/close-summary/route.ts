import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { getGuidedCloseSummary } from '@/lib/services/guided-session';
import { AppError } from '@/types/errors';

/**
 * GET /api/workouts/[id]/close-summary
 * Safe post-close facts only: streak, duration and completed-set count.
 *
 * v0.12 intentionally exposes no max-weight delta and no mixed-mode volume
 * claim here; a truthful PR, when one exists, comes from the versioned
 * progression read model (`GET /api/exercises/[id]/progression`).
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
