import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { listRoutines } from '@/lib/services/routines';

/**
 * GET /api/routines — seed (and later user) routines with ordered exercises.
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
