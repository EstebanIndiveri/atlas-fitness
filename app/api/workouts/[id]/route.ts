import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import * as workoutsService from '@/lib/services/workouts';
import { z } from 'zod';
import { AppError } from '@/types/errors';

const updateWorkoutSchema = z.object({
  endedAt: z.string().datetime().optional(),
  note: z.string().nullable().optional(),
  mood: z.number().int().min(1).max(5).nullable().optional(),
});

/**
 * GET /api/workouts/[id] - Get workout by ID with sets
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

    const workout = await workoutsService.getWorkoutById(workoutId, session.userId);

    return NextResponse.json(workout);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/workouts/[id] - Update workout
 */
export async function PATCH(
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
    const validated = updateWorkoutSchema.parse(body);

    const updateData: workoutsService.UpdateWorkoutInput = {};
    if (validated.endedAt !== undefined) {
      updateData.endedAt = new Date(validated.endedAt);
    }
    if (validated.note !== undefined) {
      updateData.note = validated.note;
    }
    if (validated.mood !== undefined) {
      updateData.mood = validated.mood;
    }

    const workout = await workoutsService.updateWorkout(
      workoutId,
      session.userId,
      updateData
    );

    return NextResponse.json(workout);
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
 * DELETE /api/workouts/[id] - Soft delete workout
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = requireAuth(request);
    const workoutId = parseInt(params.id);

    if (isNaN(workoutId)) {
      throw new AppError('VALIDATION', 'ID de entrenamiento inválido');
    }

    await workoutsService.deleteWorkout(workoutId, session.userId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
