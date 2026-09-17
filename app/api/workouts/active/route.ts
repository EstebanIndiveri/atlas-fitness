import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import * as workoutsService from '@/lib/services/workouts';

/**
 * GET /api/workouts/active
 * 200 + workout JSON when an active session exists.
 * 200 + null when none — absence is not a missing route.
 * 401 UNAUTHORIZED when unauthenticated (`requireAuth`).
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireAuth(request);
    const workout = await workoutsService.getActiveWorkout(session.userId);

    return NextResponse.json(workout);
  } catch (error) {
    return handleApiError(error);
  }
}
