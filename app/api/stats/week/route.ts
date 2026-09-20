import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { getWeekConsistencyForUser } from '@/lib/services/weekly-consistency';

/**
 * GET /api/stats/week
 * Authenticated weekly consistency snapshot for the current user
 * (Córdoba active-day rule, Monday-first). Every value is `atlas_computed`.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const week = await getWeekConsistencyForUser(session.userId);
    return NextResponse.json(week);
  } catch (error) {
    return handleApiError(error);
  }
}
