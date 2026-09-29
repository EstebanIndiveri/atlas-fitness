import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { listCurrentHabitTargets } from '@/lib/services/habit-targets';

/**
 * GET /api/habit-targets
 *
 * Authenticated, read-only current weekly targets of the user for the fixed
 * habit catalog, in catalog order. A habit with no version effective today is
 * simply absent: reading never creates intent, so an unconfigured habit can
 * never be inferred from this response (v0.10 brief §6 / §9).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const targets = await listCurrentHabitTargets(session.userId);

    return NextResponse.json(targets);
  } catch (error) {
    return handleApiError(error);
  }
}
