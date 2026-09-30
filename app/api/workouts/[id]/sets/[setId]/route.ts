import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import * as workoutSetsService from '@/lib/services/workout-sets';
import { z } from 'zod';
import { AppError } from '@/types/errors';

/**
 * PATCH accepts partial semantic fields; the service merges them into the stored
 * tuple and validates the complete resulting state atomically. Transport only
 * checks shape/types.
 */
const updateSetSchema = z.object({
  exerciseId: z.number().int().positive().optional(),
  setIndex: z.number().int().positive().optional(),
  reps: z.number().int().positive().optional(),
  weightKg: z.string().optional(),
  semanticCaptureVersion: z.number().int().positive().nullable().optional(),
  loadMode: z.string().nullable().optional(),
  amountBasis: z.string().nullable().optional(),
  side: z.string().nullable().optional(),
  setPurpose: z.string().nullable().optional(),
  repCountBasis: z.string().nullable().optional(),
});

/**
 * PATCH /api/workouts/[id]/sets/[setId] - Update a set
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; setId: string }> }
) {
  try {
    const session = await requireAuth(request);
    const { setId } = await params;
    const setIdNum = parseInt(setId);

    if (isNaN(setIdNum)) {
      throw new AppError('VALIDATION', 'ID de serie inválido');
    }

    const body = await request.json();
    const validated = updateSetSchema.parse(body);

    const workoutSet = await workoutSetsService.updateWorkoutSet({
      setId: setIdNum,
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
  { params }: { params: Promise<{ id: string; setId: string }> }
) {
  try {
    const session = await requireAuth(request);
    const { setId } = await params;
    const setIdNum = parseInt(setId);

    if (isNaN(setIdNum)) {
      throw new AppError('VALIDATION', 'ID de serie inválido');
    }

    await workoutSetsService.deleteWorkoutSet(setIdNum, session.userId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
