import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { applyWorkoutQueueAction } from '@/lib/services/session-queue';
import { AppError } from '@/types/errors';
import type { SessionQueueAction } from '@/types/session-queue';

const skipHoldBodySchema = z.object({
  exerciseId: z.number().int().positive(),
  clientMutationId: z.string().min(1).max(128),
});

export async function handleWorkoutQueueActionRequest(
  request: NextRequest,
  params: Promise<{ id: string }>,
  action: SessionQueueAction,
): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const workoutId = parseInt(id, 10);
    if (Number.isNaN(workoutId)) {
      throw new AppError('VALIDATION', 'ID de entrenamiento inválido');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError('VALIDATION', 'Body JSON inválido');
    }
    const validated = skipHoldBodySchema.parse(body);

    const result = await applyWorkoutQueueAction({
      workoutId,
      userId: session.userId,
      action,
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
