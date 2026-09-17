import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import * as workoutSetsService from '@/lib/services/workout-sets';
import { z } from 'zod';
import { AppError } from '@/types/errors';

const updateSetSchema = z.object({
  exerciseId: z.number().int().positive().optional(),
  setIndex: z.number().int().positive().optional(),
  reps: z.number().int().positive().optional(),
  weightKg: z.string().optional(),
});

/**
 * PATCH /api/workouts/[id]/sets/[setId] - Update a set
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; setId: string } }
) {
  try {
    const session = requireAuth(request);
    const setId = parseInt(params.setId);

    if (isNaN(setId)) {
      throw new AppError('VALIDATION', 'ID de serie inválido');
    }

    const body = await request.json();
    const validated = updateSetSchema.parse(body);

    const workoutSet = await workoutSetsService.updateWorkoutSet({
      setId,
      userId: session.userId,
      ...validated,
    });

    return NextResponse.json(workoutSet);
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
 * DELETE /api/workouts/[id]/sets/[setId] - Soft delete a set
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; setId: string } }
) {
  try {
    const session = requireAuth(request);
    const setId = parseInt(params.setId);

    if (isNaN(setId)) {
      throw new AppError('VALIDATION', 'ID de serie inválido');
    }

    await workoutSetsService.deleteWorkoutSet(setId, session.userId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
