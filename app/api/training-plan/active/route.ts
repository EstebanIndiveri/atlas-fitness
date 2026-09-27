import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { getActiveTrainingPlan } from '@/lib/services/training-plan';

/**
 * GET /api/training-plan/active — returns the authenticated user's active plan snapshot.
 *
 * @param request - Next.js request with authenticated session cookie.
 * @returns The active plan and its schedule, or an empty response when no plan is active.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const result = await getActiveTrainingPlan(session.userId);
    return result ? NextResponse.json(result) : new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
