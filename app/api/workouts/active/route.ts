import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import * as workoutsService from '@/lib/services/workouts';

/**
 * GET /api/workouts/active - Get active workout for user
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireAuth(request);
    const workout = await workoutsService.getActiveWorkout(session.userId);

    if (!workout) {
      return NextResponse.json(null, { status: 404 });
    }

    return NextResponse.json(workout);
  } catch (error) {
    return handleApiError(error);
  }
}
