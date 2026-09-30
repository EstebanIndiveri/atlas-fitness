import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { getExerciseSessionContext } from '@/lib/services/exercise-session-memory';
import { parseExerciseIdParam, parseWorkoutIdParam } from '../params';

/**
 * GET /api/workouts/[id]/exercises/[exerciseId]/context
 *
 * Thin, side-effect-free read of the bounded exercise-session memory for the
 * authenticated owner. Never reports an open workout as `lastCompleted`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; exerciseId: string }> },
) {
  try {
    const session = await requireAuth(request);
    const { id, exerciseId } = await params;
    const workoutId = parseWorkoutIdParam(id);
    const exercise = parseExerciseIdParam(exerciseId);

    const context = await getExerciseSessionContext(session.userId, workoutId, exercise);

    return NextResponse.json(context);
  } catch (error) {
    return handleApiError(error);
  }
}
