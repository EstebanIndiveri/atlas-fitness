import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { resolveTodayScheduledRoutine } from '@/lib/services/training-plan';

/**
 * GET /api/today
 * Authenticated snapshot of the user's scheduled routine for today.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const today = await resolveTodayScheduledRoutine(session.userId);

    return NextResponse.json(today);
  } catch (error) {
    return handleApiError(error);
  }
}
