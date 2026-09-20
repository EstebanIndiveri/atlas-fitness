import { NextRequest, NextResponse } from 'next/server';

import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import {
  getPostWorkoutFeedback,
  recordPostWorkoutFeedback,
} from '@/lib/services/post-workout-feedback';
import { AppError } from '@/types/errors';

/**
 * GET /api/workouts/[id]/feedback - Get post-workout feedback for an owned workout.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const workoutId = parseWorkoutId(id);

    const feedback = await getPostWorkoutFeedback(workoutId, session.userId);

    return NextResponse.json(feedback);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/workouts/[id]/feedback - Record optional post-workout feedback.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const workoutId = parseWorkoutId(id);

    const body = await parseJsonObject(request);
    const feedback = await recordPostWorkoutFeedback({
      ...body,
      userId: session.userId,
      workoutId,
    });

    return NextResponse.json(feedback);
  } catch (error) {
    return handleApiError(error);
  }
}

async function parseJsonObject(request: NextRequest): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError('VALIDATION', 'Body JSON inválido');
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('VALIDATION', 'Feedback post-entrenamiento inválido');
  }

  return { ...body };
}

function parseWorkoutId(id: string): number {
  const workoutId = parseInt(id, 10);
  if (!/^\d+$/.test(id) || Number.isNaN(workoutId)) {
    throw new AppError('VALIDATION', 'ID de entrenamiento inválido');
  }

  return workoutId;
}
