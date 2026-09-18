import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { deleteExercise, getExerciseById, updateExercise } from '@/lib/services/exercises';
import { AppError } from '@/types/errors';

const updateExerciseSchema = z.object({
  name: z.string().min(2).optional(),
  muscleGroup: z.string().min(2).optional(),
  instructions: z.string().min(1).optional(),
  imageUrl: z.string().url().nullable().optional(),
  videoUrl: z.string().url().nullable().optional(),
});

function parseExerciseId(id: string): number {
  const exerciseId = parseInt(id, 10);
  if (Number.isNaN(exerciseId)) {
    throw new AppError('VALIDATION', 'ID de ejercicio inválido');
  }
  return exerciseId;
}

/**
 * GET /api/exercises/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const exercise = await getExerciseById(parseExerciseId(id), session.userId);
    return NextResponse.json(exercise);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/exercises/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const parsed = updateExerciseSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Datos de ejercicio inválidos');
    }
    const updated = await updateExercise(parseExerciseId(id), session.userId, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ code: 'VALIDATION', message: 'JSON inválido' }, { status: 400 });
    }
    return handleApiError(error);
  }
}

/**
 * DELETE /api/exercises/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    await deleteExercise(parseExerciseId(id), session.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
