import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { coachAdaptationResultSchema } from '@/lib/ai/coach/adaptation';
import * as workoutsService from '@/lib/services/workouts';
import { startAdaptedWorkout } from '@/lib/services/coach-adaptation-apply';
import { AppError } from '@/types/errors';

const coachCheckInContextSchema = z
  .object({
    mood: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ]),
    energy: z.enum(['low', 'medium', 'high']),
  })
  .strict();

const createWorkoutSchema = z.object({
  routineId: z.number().int().positive().optional(),
  adaptation: z
    .object({
      result: coachAdaptationResultSchema,
      freeText: z.string().max(500).optional(),
      dailyCheckInId: z.number().int().positive().optional(),
      checkInContext: coachCheckInContextSchema.optional(),
    })
    .refine(
      (adaptation) =>
        adaptation.checkInContext === undefined || adaptation.dailyCheckInId !== undefined,
      { message: 'El contexto de adaptación requiere un check-in' },
    )
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
      const { result, freeText, dailyCheckInId, checkInContext } = parsed.data.adaptation;
      const contextSnapshot = checkInContext !== undefined
        ? { ...checkInContext, ...(freeText !== undefined ? { freeText } : {}) }
        : freeText !== undefined
          ? { freeText }
          : undefined;
      const { workout } = await startAdaptedWorkout({
        userId: session.userId,
        routineId: parsed.data.routineId,
        result,
        ...(contextSnapshot !== undefined ? { contextSnapshot } : {}),
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
