import { and, desc, eq, gte, isNotNull, isNull, lt } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { routines, workouts } from '@/lib/db/schema';
import {
  addLocalDateDays,
  cordobaLocalDate,
  cordobaLocalDateToUtcRange,
  localDateWeekdayIndex,
} from '@/lib/time/cordoba';

export type ProgressPeriod = 'week' | 'month' | 'quarter';

export interface ProgressSessionSummary {
  workoutId: number;
  startedAt: string;
  durationMinutes: number | null;
  routineName: string | null;
}

export interface ProgressSummary {
  period: ProgressPeriod;
  fromLocalDate: string;
  toLocalDate: string;
  completedSessions: number;
  totalDurationMinutes: number;
  sessions: ProgressSessionSummary[];
}

function resolveWindow(period: ProgressPeriod, now: Date): { fromLocalDate: string; toLocalDate: string } {
  const today = cordobaLocalDate(now);
  if (period === 'week') {
    const weekStart = addLocalDateDays(today, -localDateWeekdayIndex(today));
    return { fromLocalDate: weekStart, toLocalDate: addLocalDateDays(weekStart, 6) };
  }
  if (period === 'month') {
    return { fromLocalDate: addLocalDateDays(today, -29), toLocalDate: today };
  }
  return { fromLocalDate: addLocalDateDays(today, -89), toLocalDate: today };
}

/**
 * Summarizes completed workouts for a Córdoba local-date period.
 *
 * Counts only ended, non-deleted workouts owned by the user and derives duration
 * from persisted timestamps. Every returned number is real `atlas_computed` data.
 * @param userId Owner of the workouts to aggregate.
 * @param period Window to summarize: current week, last 30 days, or last 90 days.
 * @param now Clock instant used to resolve "today" in Córdoba.
 * @returns Progress summary with ordered recent sessions.
 * @throws {Error} When date window helpers receive an invalid local date.
 * @example
 * const summary = await getProgressSummary(1, 'month');
 */
export async function getProgressSummary(
  userId: number,
  period: ProgressPeriod,
  now: Date = new Date(),
): Promise<ProgressSummary> {
  const { fromLocalDate, toLocalDate } = resolveWindow(period, now);
  const { startUtc } = cordobaLocalDateToUtcRange(fromLocalDate);
  const { endUtc } = cordobaLocalDateToUtcRange(toLocalDate);

  const rows = await db
    .select({
      workoutId: workouts.id,
      startedAt: workouts.startedAt,
      endedAt: workouts.endedAt,
      routineName: routines.name,
    })
    .from(workouts)
    .leftJoin(routines, eq(workouts.routineId, routines.id))
    .where(
      and(
        eq(workouts.userId, userId),
        isNull(workouts.deletedAt),
        isNotNull(workouts.endedAt),
        gte(workouts.startedAt, startUtc),
        lt(workouts.startedAt, endUtc),
      ),
    )
    .orderBy(desc(workouts.startedAt));

  const sessions = rows.map((row): ProgressSessionSummary => {
    const durationMinutes = row.endedAt
      ? Math.round((row.endedAt.getTime() - row.startedAt.getTime()) / 60_000)
      : null;
    return {
      workoutId: row.workoutId,
      startedAt: row.startedAt.toISOString(),
      durationMinutes,
      routineName: row.routineName,
    };
  });

  return {
    period,
    fromLocalDate,
    toLocalDate,
    completedSessions: sessions.length,
    totalDurationMinutes: sessions.reduce(
      (total, session) => total + (session.durationMinutes ?? 0),
      0,
    ),
    sessions,
  };
}
