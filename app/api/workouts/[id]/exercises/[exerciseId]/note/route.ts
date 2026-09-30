import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import {
  deleteWorkoutExerciseNote,
  putWorkoutExerciseNote,
} from '@/lib/services/exercise-session-memory';
import { parseExerciseIdParam, parseJsonObject, parseWorkoutIdParam } from '../params';

/**
 * PUT /api/workouts/[id]/exercises/[exerciseId]/note
 *
 * Creates (`201`) or updates (`200`) the authenticated owner's note with
 * compare-and-swap semantics. `userId` comes only from the session.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; exerciseId: string }> },
) {
  try {
    const session = await requireAuth(request);
    const { id, exerciseId } = await params;
    const workoutId = parseWorkoutIdParam(id);
    const exercise = parseExerciseIdParam(exerciseId);
    const body = await parseJsonObject(request);

    const { note, created } = await putWorkoutExerciseNote(
      session.userId,
      workoutId,
      exercise,
      body,
    );

    return NextResponse.json(note, { status: created ? 201 : 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/workouts/[id]/exercises/[exerciseId]/note
 *
 * Deletes the authenticated owner's note with compare-and-swap semantics and
 * always returns `200 { note: null }`. `userId` comes only from the session.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; exerciseId: string }> },
) {
  try {
    const session = await requireAuth(request);
    const { id, exerciseId } = await params;
    const workoutId = parseWorkoutIdParam(id);
    const exercise = parseExerciseIdParam(exerciseId);
    const body = await parseJsonObject(request);

    const result = await deleteWorkoutExerciseNote(session.userId, workoutId, exercise, body);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
