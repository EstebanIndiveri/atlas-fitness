import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { getStreakForUser } from '@/lib/services/streaks';

/**
 * GET /api/stats/streak
 * Authenticated streak snapshot for the current user (Córdoba active-day rule).
 */
export async function GET(request: NextRequest) {
  try {
    const session = requireAuth(request);
    const streak = await getStreakForUser(session.userId);
    return NextResponse.json(streak);
  } catch (error) {
    return handleApiError(error);
  }
}
