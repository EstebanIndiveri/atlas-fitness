import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { getRoutineById } from '@/lib/services/routines';
import { AppError } from '@/types/errors';

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
    const routineId = parseInt(id, 10);
    if (Number.isNaN(routineId)) {
      throw new AppError('VALIDATION', 'ID de rutina inválido');
    }
    const routine = await getRoutineById(routineId, session.userId);
    return NextResponse.json(routine);
  } catch (error) {
    return handleApiError(error);
  }
}
