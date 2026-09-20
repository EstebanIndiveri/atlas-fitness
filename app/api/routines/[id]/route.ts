import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { deleteRoutine, getRoutineById, updateRoutine } from '@/lib/services/routines';
import { AppError } from '@/types/errors';

const routineExerciseSchema = z.object({
  exerciseId: z.number().int().positive(),
  sortOrder: z.number().int().min(0),
  targetSets: z.number().int().positive(),
  targetReps: z.number().int().positive(),
});

const updateRoutineSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  kind: z.enum(['gym', 'home']).optional(),
  restSeconds: z.number().int().min(0).max(3600).optional(),
  exercises: z.array(routineExerciseSchema).min(1).optional(),
});

function parseRoutineId(id: string): number {
  const routineId = parseInt(id, 10);
  if (Number.isNaN(routineId)) {
    throw new AppError('VALIDATION', 'ID de rutina inválido');
  }
  return routineId;
}

/**
 * GET /api/routines/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const routine = await getRoutineById(parseRoutineId(id), session.userId);
    return NextResponse.json(routine);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/routines/[id] — update own custom routine only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const parsed = updateRoutineSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Datos de rutina inválidos');
    }
    const updated = await updateRoutine(parseRoutineId(id), session.userId, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ code: 'VALIDATION', message: 'JSON inválido' }, { status: 400 });
    }
    return handleApiError(error);
  }
}

/**
 * DELETE /api/routines/[id] — soft-delete own custom routine only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    await deleteRoutine(parseRoutineId(id), session.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
