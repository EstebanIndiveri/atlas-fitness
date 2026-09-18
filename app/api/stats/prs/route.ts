import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import * as statsService from '@/lib/services/stats';

/**
 * GET /api/stats/prs - Get personal records for all exercises
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const prs = await statsService.getPersonalRecords(session.userId);

    return NextResponse.json(prs);
  } catch (error) {
    return handleApiError(error);
  }
}
