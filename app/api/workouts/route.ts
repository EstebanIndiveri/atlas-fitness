import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import * as workoutsService from '@/lib/services/workouts';

/**
 * POST /api/workouts - Create a new workout
 */
export async function POST(request: NextRequest) {
  try {
    const session = requireAuth(request);
    const workout = await workoutsService.createWorkout(session.userId);

    return NextResponse.json(workout, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/workouts - List all workouts for user
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireAuth(request);
    const workouts = await workoutsService.listWorkouts(session.userId);

    return NextResponse.json(workouts);
  } catch (error) {
    return handleApiError(error);
  }
}
