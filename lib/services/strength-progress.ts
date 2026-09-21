import { and, asc, eq, gte, isNotNull, isNull, lt } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { workouts, workoutSets } from '@/lib/db/schema';
import {
  addLocalDateDays,
  cordobaLocalDate,
  cordobaLocalDateToUtcRange,
  localDateWeekdayIndex,
} from '@/lib/time/cordoba';
import type { ProgressPeriod } from '@/lib/services/progress-summary';

export interface StrengthVolumePoint {
  workoutId: number;
  startedAt: string;
  localDate: string;
  totalVolumeKg: string;
  completedSets: number;
}

export interface StrengthProgressSummary {
  hasLoggedSets: boolean;
  latestVolumeKg: string | null;
  trendLabel: 'Sin datos de fuerza' | 'Punto de partida' | 'Subiendo' | 'Bajando' | 'Estable';
  points: StrengthVolumePoint[];
}

interface PeriodWindow {
  fromLocalDate: string;
  toLocalDate: string;
}

function resolveWindow(period: ProgressPeriod, now: Date): PeriodWindow {
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

function normalizeDecimalForComparison(value: string): { sign: 1 | -1; whole: string; fraction: string } {
  const trimmed = value.trim();
  const sign = trimmed.startsWith('-') ? -1 : 1;
  const unsigned = trimmed.replace(/^[+-]/, '');
  const [rawWhole = '0', rawFraction = ''] = unsigned.split('.');
  const whole = rawWhole.replace(/^0+(?=\d)/, '') || '0';
  const fraction = rawFraction.replace(/0+$/, '');
  return { sign, whole, fraction };
}

function compareDecimalStrings(left: string, right: string): number {
  const normalizedLeft = normalizeDecimalForComparison(left);
  const normalizedRight = normalizeDecimalForComparison(right);
  if (normalizedLeft.sign !== normalizedRight.sign) {
    return normalizedLeft.sign > normalizedRight.sign ? 1 : -1;
  }

  const signMultiplier = normalizedLeft.sign;
  if (normalizedLeft.whole.length !== normalizedRight.whole.length) {
    return normalizedLeft.whole.length > normalizedRight.whole.length ? signMultiplier : -signMultiplier;
  }
  if (normalizedLeft.whole !== normalizedRight.whole) {
    return normalizedLeft.whole > normalizedRight.whole ? signMultiplier : -signMultiplier;
  }

  const maxFractionLength = Math.max(normalizedLeft.fraction.length, normalizedRight.fraction.length);
  const leftFraction = normalizedLeft.fraction.padEnd(maxFractionLength, '0');
  const rightFraction = normalizedRight.fraction.padEnd(maxFractionLength, '0');
  if (leftFraction < rightFraction) return -signMultiplier;
  if (leftFraction > rightFraction) return signMultiplier;
  return 0;
}

function resolveTrendLabel(points: StrengthVolumePoint[]): StrengthProgressSummary['trendLabel'] {
  if (points.length === 0) {
    return 'Sin datos de fuerza';
  }
  if (points.length === 1) {
    return 'Punto de partida';
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const comparison = compareDecimalStrings(lastPoint.totalVolumeKg, firstPoint.totalVolumeKg);
  if (comparison > 0) return 'Subiendo';
  if (comparison < 0) return 'Bajando';
  return 'Estable';
}

/**
 * Aggregates honest strength volume from completed persisted workout sets.
 *
 * The source is the same persisted `workout_sets` data used by the session close
 * summary: per-session volume is `weight_kg × reps`, grouped by completed
 * workout, excluding deleted workouts/sets and in-progress sessions.
 *
 * @param userId Owner of the workouts to aggregate.
 * @param period Window to summarize: current week, last 30 days, or last 90 days.
 * @param now Clock instant used to resolve "today" in Córdoba.
 * @returns Strength progression points, or an honest empty summary when no completed sets exist.
 * @example
 * const strength = await getStrengthProgressSummary(1, 'month');
 */
export async function getStrengthProgressSummary(
  userId: number,
  period: ProgressPeriod,
  now: Date = new Date(),
): Promise<StrengthProgressSummary> {
  const { fromLocalDate, toLocalDate } = resolveWindow(period, now);
  const { startUtc } = cordobaLocalDateToUtcRange(fromLocalDate);
  const { endUtc } = cordobaLocalDateToUtcRange(toLocalDate);

  const rows = await db
    .select({
      workoutId: workouts.id,
      startedAt: workouts.startedAt,
      endedAt: workouts.endedAt,
      reps: workoutSets.reps,
      weightKg: workoutSets.weightKg,
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .where(
      and(
        eq(workouts.userId, userId),
        eq(workoutSets.completed, true),
        isNull(workouts.deletedAt),
        isNull(workoutSets.deletedAt),
        isNotNull(workouts.endedAt),
        gte(workouts.endedAt, startUtc),
        lt(workouts.endedAt, endUtc),
      ),
    )
    .orderBy(asc(workouts.endedAt), asc(workoutSets.setIndex));

  const grouped = new Map<number, { startedAt: Date; endedAt: Date; sets: { reps: number; weightKg: string }[] }>();
  for (const row of rows) {
    const existing = grouped.get(row.workoutId);
    if (existing) {
      existing.sets.push({ reps: row.reps, weightKg: row.weightKg });
    } else if (row.endedAt) {
      grouped.set(row.workoutId, {
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        sets: [{ reps: row.reps, weightKg: row.weightKg }],
      });
    }
  }

  const points = Array.from(grouped.entries()).map(([workoutId, workout]): StrengthVolumePoint => ({
    workoutId,
    startedAt: workout.startedAt.toISOString(),
    localDate: cordobaLocalDate(workout.endedAt),
    totalVolumeKg: sumVolumeKg(workout.sets),
    completedSets: workout.sets.length,
  }));
  const latestPoint = points[points.length - 1] ?? null;

  return {
    hasLoggedSets: points.length > 0,
    latestVolumeKg: latestPoint?.totalVolumeKg ?? null,
    trendLabel: resolveTrendLabel(points),
    points,
  };
}
