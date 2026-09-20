import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuth, handleApiError } from '@/lib/auth/middleware';
import { getProgressSummary } from '@/lib/services/progress-summary';
import { AppError } from '@/types/errors';

const periodSchema = z.enum(['week', 'month', 'quarter']);

/**
 * GET /api/progress/summary
 * Authenticated progress summary for a bounded Córdoba period.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const rawPeriod = request.nextUrl.searchParams.get('period') ?? 'month';
    const parsed = periodSchema.safeParse(rawPeriod);
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Período de progreso inválido');
    }

    const summary = await getProgressSummary(session.userId, parsed.data);
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
