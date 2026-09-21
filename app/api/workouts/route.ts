import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { coachAdaptationResultSchema } from '@/lib/ai/coach/adaptation';
import * as workoutsService from '@/lib/services/workouts';
import { startAdaptedWorkout } from '@/lib/services/coach-adaptation-apply';
import { AppError } from '@/types/errors';

const createWorkoutSchema = z.object({
  routineId: z.number().int().positive().optional(),
  adaptation: z
    .object({
      result: coachAdaptationResultSchema,
      freeText: z.string().max(500).optional(),
      dailyCheckInId: z.number().int().positive().optional(),
    })
    .optional(),
});

async function readOptionalJson(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }
  return JSON.parse(text) as unknown;
}

/**
 * POST /api/workouts - Create a new workout (optional routineId for guided sessions)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const raw = await readOptionalJson(request);
    const parsed = createWorkoutSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Datos de entrenamiento inválidos');
    }

    if (parsed.data.adaptation) {
      if (parsed.data.routineId === undefined) {
        throw new AppError('VALIDATION', 'La adaptación requiere una rutina');
      }
      const { result, freeText, dailyCheckInId } = parsed.data.adaptation;
      const { workout } = await startAdaptedWorkout({
        userId: session.userId,
        routineId: parsed.data.routineId,
        result,
        ...(freeText !== undefined ? { contextSnapshot: { freeText } } : {}),
        ...(dailyCheckInId !== undefined ? { dailyCheckInId } : {}),
      });
      return NextResponse.json(workout, { status: 201 });
    }

    const workout = await workoutsService.createWorkout(session.userId, parsed.data.routineId);

    return NextResponse.json(workout, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'JSON inválido' },
        { status: 400 },
      );
    }
    return handleApiError(error);
  }
}

/**
 * GET /api/workouts - List all workouts for user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const workouts = await workoutsService.listWorkouts(session.userId);

    return NextResponse.json(workouts);
  } catch (error) {
    return handleApiError(error);
  }
}
