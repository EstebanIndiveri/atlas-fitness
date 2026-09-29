import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { routines, workouts, workoutSets } from '@/lib/db/schema';
import {
  addLocalDateDays,
  cordobaLocalDate,
  cordobaLocalDateToUtcRange,
  localDateWeekdayIndex,
} from '@/lib/time/cordoba';
import { getStrengthProgressSummary } from './strength-progress';
import type { StrengthProgressSummary } from './strength-progress';

export type ProgressPeriod = 'week' | 'month' | 'quarter';

export interface ProgressSessionSummary {
  workoutId: number;
  startedAt: string;
  durationMinutes: number | null;
  routineName: string | null;
  /**
   * Exact `Σ(weight_kg × reps)` of the session's eligible sets as a decimal
   * string, or `null` only when the session genuinely has no eligible sets.
   *
   * "Eligible" mirrors the strength source: completed, non-deleted sets of a
   * completed, non-deleted workout. It is deliberately computed from the real
   * session workout ids rather than reused from the strength summary, whose
   * window is keyed by `endedAt` and can exclude a session that started inside
   * this `startedAt` window. Stays a string so no domain assert uses a float.
   */
  totalVolumeKg: string | null;
}

export interface ProgressSummary {
  period: ProgressPeriod;
  fromLocalDate: string;
  toLocalDate: string;
  completedSessions: number;
  totalDurationMinutes: number;
  strength: StrengthProgressSummary;
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
 * Exact decimal-string volume math kept local to this service.
 *
 * The same integer-string algorithm lives in `strength-progress.ts` and
 * `guided-session.ts`; only this workstream's allowed paths may be edited, so it
 * is reproduced here rather than shared through a file outside ownership. It
 * never routes weight through `Number`/`parseFloat`, keeping `weight_kg` a
 * decimal string end to end.
 */
function multiplyDecimalByInteger(value: string, multiplier: number): { units: string; scale: number } {
  const normalized = value.trim();
  const [wholePart, fractionPart = ''] = normalized.split('.');
  const units = multiplyIntegerString(`${wholePart}${fractionPart}` || '0', multiplier);
  return { units, scale: fractionPart.length };
}

function multiplyIntegerString(value: string, multiplier: number): string {
  let carry = 0;
  let result = '';
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const product = Number(value[index]) * multiplier + carry;
    result = String(product % 10) + result;
    carry = Math.floor(product / 10);
  }
  return `${carry || ''}${result}`.replace(/^0+(?=\d)/, '');
}

function addIntegerStrings(left: string, right: string): string {
  let carry = 0;
  let result = '';
  const maxLength = Math.max(left.length, right.length);
  for (let offset = 0; offset < maxLength; offset += 1) {
    const leftDigit = Number(left[left.length - 1 - offset] ?? '0');
    const rightDigit = Number(right[right.length - 1 - offset] ?? '0');
    const sum = leftDigit + rightDigit + carry;
    result = String(sum % 10) + result;
    carry = Math.floor(sum / 10);
  }
  return `${carry || ''}${result}`.replace(/^0+(?=\d)/, '');
}

function formatScaledDecimal(units: string, scale: number): string {
  if (scale === 0) {
    return units;
  }

  const raw = units.padStart(scale + 1, '0');
  const whole = raw.slice(0, -scale);
  const fraction = raw.slice(-scale).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function sumVolumeKg(sets: { reps: number; weightKg: string }[]): string {
  const products = sets.map((set) => multiplyDecimalByInteger(set.weightKg, set.reps));
  const maxScale = products.reduce((current, product) => Math.max(current, product.scale), 0);
  const totalUnits = products.reduce((total, product) => {
    const scaleDelta = maxScale - product.scale;
    return addIntegerStrings(total, `${product.units}${'0'.repeat(scaleDelta)}`);
  }, '0');

  return formatScaledDecimal(totalUnits, maxScale);
}

/**
 * Loads the exact per-session volume for the given real workout ids.
 *
 * Returns an entry for every workout that has at least one eligible set; a
 * workout with no eligible set is simply absent, so the caller can render
 * "unavailable" only when it is genuinely absent.
 */
async function loadSessionVolumes(
  userId: number,
  workoutIds: number[],
): Promise<Map<number, string>> {
  const volumes = new Map<number, string>();
  if (workoutIds.length === 0) {
    return volumes;
  }

  const rows = await db
    .select({
      workoutId: workoutSets.workoutId,
      reps: workoutSets.reps,
      weightKg: workoutSets.weightKg,
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .where(
      and(
        inArray(workoutSets.workoutId, workoutIds),
        eq(workouts.userId, userId),
        eq(workoutSets.completed, true),
        isNull(workoutSets.deletedAt),
      ),
    )
    .orderBy(asc(workoutSets.workoutId), asc(workoutSets.setIndex));

  const grouped = new Map<number, { reps: number; weightKg: string }[]>();
  for (const row of rows) {
    const existing = grouped.get(row.workoutId);
    if (existing) {
      existing.push({ reps: row.reps, weightKg: row.weightKg });
    } else {
      grouped.set(row.workoutId, [{ reps: row.reps, weightKg: row.weightKg }]);
    }
  }

  for (const [workoutId, sets] of grouped) {
    volumes.set(workoutId, sumVolumeKg(sets));
  }

  return volumes;
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

  const volumesByWorkout = await loadSessionVolumes(
    userId,
    rows.map((row) => row.workoutId),
  );

  const sessions = rows.map((row): ProgressSessionSummary => {
    const durationMinutes = row.endedAt
      ? Math.round((row.endedAt.getTime() - row.startedAt.getTime()) / 60_000)
      : null;
    return {
      workoutId: row.workoutId,
      startedAt: row.startedAt.toISOString(),
      durationMinutes,
      routineName: row.routineName,
      totalVolumeKg: volumesByWorkout.get(row.workoutId) ?? null,
    };
  });
  const strength = await getStrengthProgressSummary(userId, period, now);

  return {
    period,
    fromLocalDate,
    toLocalDate,
    completedSessions: sessions.length,
    totalDurationMinutes: sessions.reduce(
      (total, session) => total + (session.durationMinutes ?? 0),
      0,
    ),
    strength,
    sessions,
  };
}
