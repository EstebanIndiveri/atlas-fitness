import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { createRoutine, listRoutines } from '@/lib/services/routines';
import { AppError } from '@/types/errors';

const routineExerciseSchema = z.object({
  exerciseId: z.number().int().positive(),
  sortOrder: z.number().int().min(0),
  targetSets: z.number().int().positive(),
  targetReps: z.number().int().positive(),
});

const createRoutineSchema = z.object({
  name: z.string().min(2),
  description: z.string().nullable().optional(),
  kind: z.enum(['gym', 'home']),
  restSeconds: z.number().int().min(0).max(3600).optional(),
  exercises: z.array(routineExerciseSchema).min(1),
});

/**
 * GET /api/routines — system + current user custom routines with ordered exercises.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const routines = await listRoutines(session.userId);
    return NextResponse.json(routines);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/routines — create a user-owned custom routine.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const parsed = createRoutineSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Datos de rutina inválidos');
    }
    const created = await createRoutine(session.userId, parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ code: 'VALIDATION', message: 'JSON inválido' }, { status: 400 });
    }
    return handleApiError(error);
  }
}
