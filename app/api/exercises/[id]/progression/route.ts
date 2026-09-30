import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import {
  DEFAULT_PROGRESSION_HISTORY_LIMIT,
  MAX_PROGRESSION_HISTORY_LIMIT,
  getExerciseProgression,
} from '@/lib/services/exercise-progression';
import { AppError } from '@/types/errors';

/**
 * Transport shape only. The cohort (`loadMode=external`, `purpose=working`) is
 * fixed by the metric; the caller selects reps/basis/side and optional bounded
 * history parameters. There is no candidate-workout parameter in v0.12.
 */
const progressionQuerySchema = z.object({
  reps: z.coerce.number().int().positive(),
  amountBasis: z.enum(['total', 'per_side']),
  side: z.enum(['bilateral', 'left', 'right']),
  limit: z.coerce.number().int().positive().max(MAX_PROGRESSION_HISTORY_LIMIT).optional(),
  cursor: z.string().min(1).optional(),
});

/**
 * GET /api/exercises/[id]/progression?reps=&amountBasis=&side=&limit=&cursor=
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const exerciseId = parseInt(id);
    if (isNaN(exerciseId)) {
      throw new AppError('VALIDATION', 'ID de ejercicio inválido');
    }

    const searchParams = request.nextUrl.searchParams;
    const parsed = progressionQuerySchema.parse({
      reps: searchParams.get('reps') ?? undefined,
      amountBasis: searchParams.get('amountBasis') ?? undefined,
      side: searchParams.get('side') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
    });

    const progression = await getExerciseProgression({
      exerciseId,
      userId: session.userId,
      reps: parsed.reps,
      amountBasis: parsed.amountBasis,
      side: parsed.side,
      limit: parsed.limit ?? DEFAULT_PROGRESSION_HISTORY_LIMIT,
      cursor: parsed.cursor ?? null,
    });

    return NextResponse.json(progression);
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
