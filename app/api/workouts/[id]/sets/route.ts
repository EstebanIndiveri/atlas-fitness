import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import * as workoutSetsService from '@/lib/services/workout-sets';
import { z } from 'zod';
import { AppError } from '@/types/errors';

/**
 * Semantic shape only. Domain validity (mode/basis/side/amount combination) is
 * decided by the progression domain (`validateSemanticCapture`), never here.
 * The keys stay optional at the transport boundary so an outdated client that
 * omits the tuple reaches the service and receives a typed validation failure
 * instead of silently creating an all-null row.
 */
const semanticShape = {
  semanticCaptureVersion: z.number().int().positive().nullable().optional(),
  loadMode: z.string().nullable().optional(),
  amountBasis: z.string().nullable().optional(),
  side: z.string().nullable().optional(),
  setPurpose: z.string().nullable().optional(),
  repCountBasis: z.string().nullable().optional(),
};

const createSetSchema = z.object({
  exerciseId: z.number().int().positive(),
  setIndex: z.number().int().positive(),
  reps: z.number().int().positive(),
  weightKg: z.string(),
  ...semanticShape,
});

/**
 * POST /api/workouts/[id]/sets - Create a new set for a workout
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const workoutId = parseInt(id);

    if (isNaN(workoutId)) {
      throw new AppError('VALIDATION', 'ID de entrenamiento inválido');
    }

    const body = await request.json();
    const validated = createSetSchema.parse(body);

    const workoutSet = await workoutSetsService.createWorkoutSet({
      workoutId,
      userId: session.userId,
      exerciseId: validated.exerciseId,
      setIndex: validated.setIndex,
      reps: validated.reps,
      weightKg: validated.weightKg,
      semanticCaptureVersion: validated.semanticCaptureVersion ?? null,
      loadMode: validated.loadMode ?? null,
      amountBasis: validated.amountBasis ?? null,
      side: validated.side ?? null,
      setPurpose: validated.setPurpose ?? null,
      repCountBasis: validated.repCountBasis ?? null,
    });

    return NextResponse.json(workoutSet, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { code: 'VALIDATION', message: error.issues[0].message },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
}

/**
 * GET /api/workouts/[id]/sets - List all sets for a workout
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const workoutId = parseInt(id);

    if (isNaN(workoutId)) {
      throw new AppError('VALIDATION', 'ID de entrenamiento inválido');
    }

    const sets = await workoutSetsService.listWorkoutSets(workoutId, session.userId);

    return NextResponse.json(sets);
  } catch (error) {
    return handleApiError(error);
  }
}
