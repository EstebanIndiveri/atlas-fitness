import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { db } from '@/lib/db/client';
import { exercises } from '@/lib/db/schema';
import { isNull } from 'drizzle-orm';

/**
 * GET /api/exercises - List all system exercises (excluding soft deleted)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const allExercises = await db.query.exercises.findMany({
      where: isNull(exercises.deletedAt),
      orderBy: (exercises, { asc }) => [asc(exercises.name)],
    });

    return NextResponse.json(allExercises);
  } catch (error) {
    return handleApiError(error);
  }
}
