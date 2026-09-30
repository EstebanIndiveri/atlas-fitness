import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import * as statsService from '@/lib/services/stats';
import { AppError } from '@/types/errors';

function parseLimit(value: string | null): number | undefined {
  if (value === null || value.trim() === '') {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError('VALIDATION', 'Límite inválido');
  }
  return parsed;
}

/**
 * GET /api/stats/exercise/[id]/history - raw, bounded exact-exercise history.
 *
 * This is a compatibility surface: it exposes recorded sets and their declared
 * semantics (or unknown), never a PR/improvement/strength claim.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const exerciseId = parseInt(id);

    if (isNaN(exerciseId)) {
      throw new AppError('VALIDATION', 'ID de ejercicio inválido');
    }

    const searchParams = request.nextUrl.searchParams;
    const history = await statsService.getExerciseHistory(exerciseId, session.userId, {
      limit: parseLimit(searchParams.get('limit')),
      cursor: searchParams.get('cursor'),
    });

    return NextResponse.json(history);
  } catch (error) {
    return handleApiError(error);
  }
}
