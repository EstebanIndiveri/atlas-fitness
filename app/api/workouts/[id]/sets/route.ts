import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import * as workoutSetsService from '@/lib/services/workout-sets';
import { z } from 'zod';
import { AppError } from '@/types/errors';

const createSetSchema = z.object({
  exerciseId: z.number().int().positive(),
  setIndex: z.number().int().positive(),
  reps: z.number().int().positive(),
  weightKg: z.string(),
});

/**
 * POST /api/workouts/[id]/sets - Create a new set for a workout
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = requireAuth(request);
    const workoutId = parseInt(params.id);

    if (isNaN(workoutId)) {
      throw new AppError('VALIDATION', 'ID de entrenamiento inválido');
    }

    const body = await request.json();
    const validated = createSetSchema.parse(body);

    const workoutSet = await workoutSetsService.createWorkoutSet({
      workoutId,
      userId: session.userId,
      exerciseId: validated.exerciseId,
      setIndex: validated.setIndex,
      reps: validated.reps,
      weightKg: validated.weightKg,
    });

    return NextResponse.json(workoutSet, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { code: 'VALIDATION', message: error.issues[0].message },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
}

/**
 * GET /api/workouts/[id]/sets - List all sets for a workout
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = requireAuth(request);
    const workoutId = parseInt(params.id);

    if (isNaN(workoutId)) {
      throw new AppError('VALIDATION', 'ID de entrenamiento inválido');
    }

    const sets = await workoutSetsService.listWorkoutSets(workoutId, session.userId);

    return NextResponse.json(sets);
  } catch (error) {
    return handleApiError(error);
  }
}
