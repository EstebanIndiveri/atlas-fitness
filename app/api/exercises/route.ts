import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { createExercise, listExercises } from '@/lib/services/exercises';
import { AppError } from '@/types/errors';

const createExerciseSchema = z.object({
  name: z.string().min(2),
  muscleGroup: z.string().min(2),
  instructions: z.string().min(1),
  imageUrl: z.string().url().nullable().optional(),
  videoUrl: z.string().url().nullable().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});

/**
 * GET /api/exercises — system + current user custom catalog (no userId).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const catalog = await listExercises(session.userId);
    return NextResponse.json(catalog);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/exercises — create a user-owned custom exercise.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const parsed = createExerciseSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Datos de ejercicio inválidos');
    }
    const created = await createExercise(session.userId, parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ code: 'VALIDATION', message: 'JSON inválido' }, { status: 400 });
    }
    return handleApiError(error);
  }
}
