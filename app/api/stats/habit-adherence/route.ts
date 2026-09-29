import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { handleApiError, requireAuth } from '@/lib/auth/middleware';
import { computeHabitTargetAdherence } from '@/lib/services/habit-target-adherence';
import { loadHabitActivityInWindow } from '@/lib/services/habit-logs';
import { loadHabitTargetVersionsInWindow } from '@/lib/services/habit-targets';
import { cordobaLocalDate } from '@/lib/time/cordoba';
import { AppError } from '@/types/errors';
import type { HabitTargetAdherencePeriod } from '@/types/habit-adherence';

const periodSchema = z.enum(['week', 'month', 'quarter']);

interface AdherenceWindowBounds {
  start: string;
  end: string;
}

/**
 * Resolves the bounded-loader window through the canonical pure window resolver.
 *
 * The pure core owns `week`/`month`/`quarter` window semantics, so asking it for
 * the bounds keeps the two bounded queries and the derived window from
 * diverging: there is a single source of window truth and no duplicated math.
 * Empty schedules/logs only probe the bounds; the real computation follows.
 */
function resolveAdherenceWindowBounds(
  period: HabitTargetAdherencePeriod,
  today: string,
): AdherenceWindowBounds {
  const { windowStart, windowEnd } = computeHabitTargetAdherence({
    period,
    today,
    schedules: [],
    logs: [],
  });

  return { start: windowStart, end: windowEnd };
}

/**
 * GET /api/stats/habit-adherence?period=week|month|quarter
 *
 * Authenticated, read-only target adherence for the session user over a bounded
 * Córdoba window. The route only wires the bounded loaders to the pure core, so
 * every count, state and percentage is derived from explicit intent plus real
 * logs — never inferred. `configurationState` (current intent) and `metricState`
 * (window denominator) stay independent, so an ended schedule can still return a
 * historical result. Reads have no side effects. An unusable period is `400`; a
 * missing session is `401`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAuth(request);
    const rawPeriod = request.nextUrl.searchParams.get('period') ?? 'week';
    const parsed = periodSchema.safeParse(rawPeriod);

    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Período de cumplimiento de hábitos inválido');
    }

    const today = cordobaLocalDate();
    const bounds = resolveAdherenceWindowBounds(parsed.data, today);
    const [schedules, logs] = await Promise.all([
      loadHabitTargetVersionsInWindow(session.userId, bounds.start, bounds.end),
      loadHabitActivityInWindow(session.userId, bounds.start, bounds.end),
    ]);

    const window = computeHabitTargetAdherence({
      period: parsed.data,
      today,
      schedules,
      logs,
    });

    return NextResponse.json(window);
  } catch (error) {
    return handleApiError(error);
  }
}
