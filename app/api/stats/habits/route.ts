import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { getHabitActivityForUser } from '@/lib/services/habit-activity';
import { AppError } from '@/types/errors';

const periodSchema = z.enum(['week', 'month', 'quarter']);

/**
 * GET /api/stats/habits
 * Authenticated, read-only habit activity for the current user over a bounded Córdoba
 * period: the current Monday-first week, the last 30 days, or the last 90 days.
 *
 * The window is always scoped to the session user and always truthful: counts cover the
 * whole window and no target, composite, or percentage claim is derived here.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const rawPeriod = request.nextUrl.searchParams.get('period') ?? 'week';
    const parsed = periodSchema.safeParse(rawPeriod);
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Período de actividad de hábitos inválido');
    }

    const window = await getHabitActivityForUser(session.userId, parsed.data);
    return NextResponse.json(window);
  } catch (error) {
    return handleApiError(error);
  }
}
