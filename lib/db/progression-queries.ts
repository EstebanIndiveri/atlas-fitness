import { and, asc, desc, eq, gt, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { workouts, workoutSets } from '@/lib/db/schema';
import type { ExerciseHistoryCursor } from '@/lib/db/keyset-cursor';
import type { AmountBasis, Side } from '@/types/progression';

/**
 * Production SQL for the progression read model.
 *
 * The query builders live here (not inline in the service) so the service, the
 * `EXPLAIN QUERY PLAN` gate and any future consumer share exactly one shape.
 * SQL is only the *pre-filter*: it narrows candidates through the B indexes.
 * Canonicalization and eligibility stay in the pure domain
 * (`canonicalSemantics` / `classifyEligibility`), applied by the service.
 */

export type ProgressionSide = Extract<Side, 'bilateral' | 'left' | 'right'>;

export interface ProgressionCohortFilters {
  exerciseId: number;
  userId: number;
  reps: number;
  amountBasis: AmountBasis;
  side: ProgressionSide;
}

export interface ProgressionPrior {
  endedAt: Date;
  workoutId: number;
}

/** Upper bound on candidate rows scanned so a pathological cohort cannot fan out. */
export const PROGRESSION_CANDIDATE_LIMIT = 200;

/** Upper bound on closed workouts inspected when locating the latest eligible one. */
export const LATEST_WORKOUT_SCAN_LIMIT = 50;

/**
 * Decimal-exact descending weight ordering. MUST stay identical to the
 * expression in the B migration index `workout_sets_external_pr_cohort_idx`.
 */
export const WEIGHT_INTEGER_LENGTH_DESC = sql`(length(CASE WHEN instr(${workoutSets.weightKg}, '.') = 0 THEN ${workoutSets.weightKg} ELSE substr(${workoutSets.weightKg}, 1, instr(${workoutSets.weightKg}, '.') - 1) END)) DESC`;
export const WEIGHT_INTEGER_PART_DESC = sql`(CASE WHEN instr(${workoutSets.weightKg}, '.') = 0 THEN ${workoutSets.weightKg} ELSE substr(${workoutSets.weightKg}, 1, instr(${workoutSets.weightKg}, '.') - 1) END) DESC`;
export const WEIGHT_FRACTION_PART_DESC = sql`(CASE WHEN instr(${workoutSets.weightKg}, '.') = 0 THEN '' ELSE substr(${workoutSets.weightKg}, instr(${workoutSets.weightKg}, '.') + 1) END) DESC`;

/** Set columns plus the owning workout's close timestamp. */
export const PROGRESSION_EVIDENCE_COLUMNS = {
  setId: workoutSets.id,
  workoutId: workoutSets.workoutId,
  exerciseId: workoutSets.exerciseId,
  setIndex: workoutSets.setIndex,
  reps: workoutSets.reps,
  weightKg: workoutSets.weightKg,
  completed: workoutSets.completed,
  semanticCaptureVersion: workoutSets.semanticCaptureVersion,
  loadMode: workoutSets.loadMode,
  amountBasis: workoutSets.amountBasis,
  side: workoutSets.side,
  setPurpose: workoutSets.setPurpose,
  repCountBasis: workoutSets.repCountBasis,
  endedAt: workouts.endedAt,
} as const;

function cohortConditions(filters: ProgressionCohortFilters) {
  return and(
    eq(workoutSets.exerciseId, filters.exerciseId),
    eq(workoutSets.loadMode, 'external'),
    eq(workoutSets.amountBasis, filters.amountBasis),
    eq(workoutSets.side, filters.side),
    eq(workoutSets.reps, filters.reps),
    eq(workoutSets.setPurpose, 'working'),
    eq(workoutSets.completed, true),
    isNull(workoutSets.deletedAt),
  );
}

function closedWorkoutConditions(userId: number) {
  return and(
    eq(workouts.userId, userId),
    isNull(workouts.deletedAt),
    isNotNull(workouts.endedAt),
  );
}

function priorCondition(prior?: ProgressionPrior) {
  if (!prior) {
    return undefined;
  }
  return or(
    lt(workouts.endedAt, prior.endedAt),
    and(eq(workouts.endedAt, prior.endedAt), lt(workouts.id, prior.workoutId)),
  );
}

/** Candidate sets of the exact cohort, ordered decimal-exact high → low. */
export function cohortCandidatesQuery(
  filters: ProgressionCohortFilters,
  prior?: ProgressionPrior,
  limit: number = PROGRESSION_CANDIDATE_LIMIT,
) {
  return db
    .select(PROGRESSION_EVIDENCE_COLUMNS)
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(and(cohortConditions(filters), closedWorkoutConditions(filters.userId), priorCondition(prior)))
    .orderBy(WEIGHT_INTEGER_LENGTH_DESC, WEIGHT_INTEGER_PART_DESC, WEIGHT_FRACTION_PART_DESC)
    .limit(limit);
}

/** Every candidate set of one closed workout in the cohort (source tie order). */
export function workoutCohortRowsQuery(filters: ProgressionCohortFilters, workoutId: number) {
  return db
    .select(PROGRESSION_EVIDENCE_COLUMNS)
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(
      and(
        cohortConditions(filters),
        closedWorkoutConditions(filters.userId),
        eq(workoutSets.workoutId, workoutId),
      ),
    )
    .orderBy(asc(workoutSets.setIndex), asc(workoutSets.id));
}

/**
 * Distinct candidate closed workouts in the cohort, latest first. The service
 * then verifies each through the pure domain, so a raw-only-corrupt workout is
 * skipped instead of blocking the latest *eligible* workout.
 */
export function latestCohortWorkoutsQuery(
  filters: ProgressionCohortFilters,
  prior?: ProgressionPrior,
  limit: number = LATEST_WORKOUT_SCAN_LIMIT,
) {
  return db
    .selectDistinct({ workoutId: workouts.id, endedAt: workouts.endedAt })
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(and(cohortConditions(filters), closedWorkoutConditions(filters.userId), priorCondition(prior)))
    .orderBy(desc(workouts.endedAt), desc(workouts.id))
    .limit(limit);
}

function historyKeyset(cursor: ExerciseHistoryCursor | null) {
  if (!cursor) {
    return undefined;
  }
  const cursorEndedAt = new Date(cursor.sortAt);
  return or(
    lt(workouts.endedAt, cursorEndedAt),
    and(eq(workouts.endedAt, cursorEndedAt), lt(workouts.id, cursor.workoutId)),
    and(
      eq(workouts.endedAt, cursorEndedAt),
      eq(workouts.id, cursor.workoutId),
      gt(workoutSets.setIndex, cursor.setIndex),
    ),
    and(
      eq(workouts.endedAt, cursorEndedAt),
      eq(workouts.id, cursor.workoutId),
      eq(workoutSets.setIndex, cursor.setIndex),
      gt(workoutSets.id, cursor.setId),
    ),
  );
}

/** Bounded, keyset exact-exercise history page over closed workouts. */
export function boundedProgressionHistoryQuery(
  input: { exerciseId: number; userId: number },
  cursor: ExerciseHistoryCursor | null,
  limit: number,
) {
  return db
    .select(PROGRESSION_EVIDENCE_COLUMNS)
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(
      and(
        eq(workoutSets.exerciseId, input.exerciseId),
        eq(workouts.userId, input.userId),
        isNull(workouts.deletedAt),
        isNull(workoutSets.deletedAt),
        isNotNull(workouts.endedAt),
        historyKeyset(cursor),
      ),
    )
    .orderBy(
      desc(workouts.endedAt),
      desc(workouts.id),
      asc(workoutSets.setIndex),
      asc(workoutSets.id),
    )
    .limit(limit + 1);
}
