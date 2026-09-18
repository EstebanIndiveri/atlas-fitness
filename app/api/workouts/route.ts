import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import * as workoutsService from '@/lib/services/workouts';
import { z } from 'zod';

const createWorkoutSchema = z.object({
  routineId: z.number().int().positive().optional(),
});

async function readOptionalJson(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }
  return JSON.parse(text) as unknown;
}

/**
 * POST /api/workouts - Create a new workout (optional routineId for guided sessions)
 */
export async function POST(request: NextRequest) {
  try {
    const session = requireAuth(request);
    const raw = await readOptionalJson(request);
    const parsed = createWorkoutSchema.safeParse(raw);
    const routineId = parsed.success ? parsed.data.routineId : undefined;
    const workout = await workoutsService.createWorkout(session.userId, routineId);

    return NextResponse.json(workout, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'JSON inválido' },
        { status: 400 },
      );
    }
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
