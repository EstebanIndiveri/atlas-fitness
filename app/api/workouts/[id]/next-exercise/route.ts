import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { suggestNextExerciseForWorkout } from '@/lib/services/guided-session';
import { AppError } from '@/types/errors';

/**
 * POST /api/workouts/[id]/next-exercise
 * Gemini (server-side) with deterministic routine-order fallback (ADR-003).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = requireAuth(request);
    const { id } = await params;
    const workoutId = parseInt(id, 10);
    if (Number.isNaN(workoutId)) {
      throw new AppError('VALIDATION', 'ID de entrenamiento inválido');
    }

    const suggestion = await suggestNextExerciseForWorkout(workoutId, session.userId);
    return NextResponse.json(suggestion);
  } catch (error) {
    return handleApiError(error);
  }
}
