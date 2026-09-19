import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { applyWorkoutQueueAction } from '@/lib/services/session-queue';
import { AppError } from '@/types/errors';

const skipHoldBodySchema = z.object({
  exerciseId: z.number().int().positive(),
  clientMutationId: z.string().min(1).max(128),
});

/**
 * POST /api/workouts/[id]/hold
 * Move the current exercise to the end of this session queue (returns later).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const workoutId = parseInt(id, 10);
    if (Number.isNaN(workoutId)) {
      throw new AppError('VALIDATION', 'ID de entrenamiento inválido');
    }

    const body = await request.json();
    const validated = skipHoldBodySchema.parse(body);

    const result = await applyWorkoutQueueAction({
      workoutId,
      userId: session.userId,
      action: 'hold',
      exerciseId: validated.exerciseId,
      clientMutationId: validated.clientMutationId,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { code: 'VALIDATION', message: error.issues[0].message },
        { status: 400 },
      );
    }
    return handleApiError(error);
  }
}
