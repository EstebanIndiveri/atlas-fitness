import { and, asc, desc, eq, gt, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { workouts, workoutSets } from '@/lib/db/schema';
import {
  decodeExerciseHistoryCursor,
  encodeExerciseHistoryCursor,
} from '@/lib/db/keyset-cursor';
import { requireAccessibleExercise } from '@/lib/services/exercises';
import { compareToPriorBest, selectWorkoutRepresentative } from '@/lib/progression';
import { canonicalSemantics } from '@/lib/progression/semantics';
import { cordobaLocalDate } from '@/lib/time/cordoba';
import { PROGRESSION_RULE_VERSION, SAME_REPS_EXTERNAL_LOAD_METRIC } from '@/types/progression';
import { AppError } from '@/types/errors';
import type {
  AmountBasis,
  CanonicalSemantics,
  CohortKey,
  EligibleSet,
  Side,
  WorkoutRepresentative,
} from '@/types/progression';
import type {
  ExerciseProgression,
  ProgressionHistoryItem,
  ProgressionHistoryPage,
  ProgressionReadStatus,
  ProgressionSemantics,
  ProgressionSourceSet,
} from '@/types/progression-read';

/** Supported MVP PR sides; `alternating` is recorded but never compared. */
export type ProgressionSide = Extract<Side, 'bilateral' | 'left' | 'right'>;

export interface ExerciseProgressionInput {
  exerciseId: number;
  userId: number;
  reps: number;
  amountBasis: AmountBasis;
  side: ProgressionSide;
  limit: number;
  cursor: string | null;
}

export const DEFAULT_PROGRESSION_HISTORY_LIMIT = 10;
export const MAX_PROGRESSION_HISTORY_LIMIT = 50;

/** Decimal-exact descending weight ordering, matching the B migration index. */
const WEIGHT_INTEGER_LENGTH_DESC = sql`(length(CASE WHEN instr(${workoutSets.weightKg}, '.') = 0 THEN ${workoutSets.weightKg} ELSE substr(${workoutSets.weightKg}, 1, instr(${workoutSets.weightKg}, '.') - 1) END)) DESC`;
const WEIGHT_INTEGER_PART_DESC = sql`(CASE WHEN instr(${workoutSets.weightKg}, '.') = 0 THEN ${workoutSets.weightKg} ELSE substr(${workoutSets.weightKg}, 1, instr(${workoutSets.weightKg}, '.') - 1) END) DESC`;
const WEIGHT_FRACTION_PART_DESC = sql`(CASE WHEN instr(${workoutSets.weightKg}, '.') = 0 THEN '' ELSE substr(${workoutSets.weightKg}, instr(${workoutSets.weightKg}, '.') + 1) END) DESC`;

const SET_COLUMNS = {
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
} as const;

interface SetRow {
  setId: number;
  workoutId: number;
  exerciseId: number;
  setIndex: number;
  reps: number;
  weightKg: string;
  completed: boolean;
  semanticCaptureVersion: number | null;
  loadMode: string | null;
  amountBasis: string | null;
  side: string | null;
  setPurpose: string | null;
  repCountBasis: string | null;
}

function cohortConditions(input: ExerciseProgressionInput) {
  return and(
    eq(workoutSets.exerciseId, input.exerciseId),
    eq(workoutSets.loadMode, 'external'),
    eq(workoutSets.amountBasis, input.amountBasis),
    eq(workoutSets.side, input.side),
    eq(workoutSets.reps, input.reps),
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

function buildCohortKey(input: ExerciseProgressionInput): CohortKey {
  return {
    exerciseId: input.exerciseId,
    loadMode: 'external',
    amountBasis: input.amountBasis,
    side: input.side,
    reps: input.reps,
  };
}

function buildCanonical(input: ExerciseProgressionInput): CanonicalSemantics {
  return {
    loadMode: 'external',
    amountBasis: input.amountBasis,
    side: input.side,
    setPurpose: 'working',
    repCountBasis: null,
  };
}

function toEligibleSet(row: SetRow, endedAt: Date, input: ExerciseProgressionInput): EligibleSet {
  return {
    observation: {
      setId: row.setId,
      workoutId: row.workoutId,
      exerciseId: row.exerciseId,
      setIndex: row.setIndex,
      reps: row.reps,
      weightKg: row.weightKg,
      completed: true,
      setDeleted: false,
      workoutEndedAt: endedAt,
      workoutDeleted: false,
      exerciseAvailable: true,
      semantics: {
        semanticCaptureVersion: row.semanticCaptureVersion,
        loadMode: row.loadMode,
        amountBasis: row.amountBasis,
        side: row.side,
        setPurpose: row.setPurpose,
        repCountBasis: row.repCountBasis,
      },
    },
    canonical: buildCanonical(input),
    cohort: buildCohortKey(input),
  };
}

function declaredSemantics(canonical: CanonicalSemantics): ProgressionSemantics {
  return {
    semanticCaptureVersion: 1,
    loadMode: canonical.loadMode,
    amountBasis: canonical.amountBasis,
    side: canonical.side,
    setPurpose: canonical.setPurpose,
    repCountBasis: canonical.repCountBasis,
  };
}

function toSourceSet(
  representative: WorkoutRepresentative,
  semantics: ProgressionSemantics,
): ProgressionSourceSet {
  return {
    setId: representative.setId,
    workoutId: representative.workoutId,
    setIndex: representative.setIndex,
    reps: representative.reps,
    weightKg: representative.weightKg,
    endedAt: representative.endedAt.toISOString(),
    localDate: cordobaLocalDate(representative.endedAt),
    semantics,
    provenance: 'user_input',
  };
}

/** Historical semantics for a raw row; null when legacy/unknown/corrupt. */
function rowSemantics(row: SetRow): ProgressionSemantics | null {
  const canonical = canonicalSemantics(row.semanticCaptureVersion, {
    loadMode: row.loadMode,
    amountBasis: row.amountBasis,
    side: row.side,
    setPurpose: row.setPurpose,
    repCountBasis: row.repCountBasis,
  });
  return canonical.status === 'canonical' ? declaredSemantics(canonical.tuple) : null;
}

function rowPurpose(row: SetRow): ProgressionHistoryItem['setPurpose'] {
  const canonical = canonicalSemantics(row.semanticCaptureVersion, {
    loadMode: row.loadMode,
    amountBasis: row.amountBasis,
    side: row.side,
    setPurpose: row.setPurpose,
    repCountBasis: row.repCountBasis,
  });
  return canonical.status === 'canonical' ? canonical.tuple.setPurpose : null;
}

function isComparable(row: SetRow, input: ExerciseProgressionInput): boolean {
  return (
    row.completed &&
    row.loadMode === 'external' &&
    row.setPurpose === 'working' &&
    row.side === input.side &&
    row.amountBasis === input.amountBasis &&
    row.reps === input.reps
  );
}

function boundedLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1) {
    return DEFAULT_PROGRESSION_HISTORY_LIMIT;
  }
  return Math.min(limit, MAX_PROGRESSION_HISTORY_LIMIT);
}

async function loadWorkoutRepresentative(
  input: ExerciseProgressionInput,
  workoutId: number,
  endedAt: Date,
): Promise<WorkoutRepresentative | null> {
  const rows: SetRow[] = await db
    .select(SET_COLUMNS)
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(
      and(
        cohortConditions(input),
        closedWorkoutConditions(input.userId),
        eq(workoutSets.workoutId, workoutId),
      ),
    )
    .orderBy(asc(workoutSets.setIndex), asc(workoutSets.id));

  return selectWorkoutRepresentative(rows.map((row) => toEligibleSet(row, endedAt, input)));
}

async function loadLatestWorkout(
  input: ExerciseProgressionInput,
  prior?: { endedAt: Date; workoutId: number },
): Promise<{ workoutId: number; endedAt: Date } | null> {
  const priorWhere = prior
    ? or(
        lt(workouts.endedAt, prior.endedAt),
        and(eq(workouts.endedAt, prior.endedAt), lt(workouts.id, prior.workoutId)),
      )
    : undefined;

  const rows = await db
    .select({ workoutId: workouts.id, endedAt: workouts.endedAt })
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(and(cohortConditions(input), closedWorkoutConditions(input.userId), priorWhere))
    .orderBy(desc(workouts.endedAt), desc(workouts.id))
    .limit(1);

  const row = rows[0];
  if (!row || row.endedAt === null) {
    return null;
  }
  return { workoutId: row.workoutId, endedAt: row.endedAt };
}

interface CohortBest {
  setId: number;
  workoutId: number;
  setIndex: number;
  reps: number;
  weightKg: string;
  endedAt: Date;
}

/** Exact decimal-max cohort aggregate; optional `prior` restricts to earlier workouts. */
async function loadCohortBest(
  input: ExerciseProgressionInput,
  prior?: { endedAt: Date; workoutId: number },
): Promise<CohortBest | null> {
  const priorWhere = prior
    ? or(
        lt(workouts.endedAt, prior.endedAt),
        and(eq(workouts.endedAt, prior.endedAt), lt(workouts.id, prior.workoutId)),
      )
    : undefined;

  const rows = await db
    .select({
      setId: workoutSets.id,
      workoutId: workoutSets.workoutId,
      setIndex: workoutSets.setIndex,
      reps: workoutSets.reps,
      weightKg: workoutSets.weightKg,
      endedAt: workouts.endedAt,
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(and(cohortConditions(input), closedWorkoutConditions(input.userId), priorWhere))
    .orderBy(WEIGHT_INTEGER_LENGTH_DESC, WEIGHT_INTEGER_PART_DESC, WEIGHT_FRACTION_PART_DESC)
    .limit(1);

  const row = rows[0];
  if (!row || row.endedAt === null) {
    return null;
  }
  return {
    setId: row.setId,
    workoutId: row.workoutId,
    setIndex: row.setIndex,
    reps: row.reps,
    weightKg: row.weightKg,
    endedAt: row.endedAt,
  };
}

async function hasAnyLiveSet(
  userId: number,
  exerciseId: number,
  semanticOnly: boolean,
): Promise<boolean> {
  const rows = await db
    .select({ id: workoutSets.id })
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(
      and(
        eq(workoutSets.exerciseId, exerciseId),
        eq(workouts.userId, userId),
        isNull(workouts.deletedAt),
        isNull(workoutSets.deletedAt),
        semanticOnly ? isNotNull(workoutSets.semanticCaptureVersion) : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

interface HistoryPageRow extends SetRow {
  endedAt: Date | null;
}

/**
 * Bounded, keyset history page over the exact exercise's closed workouts in
 * Córdoba order. The page limit never influences the PR/best result, which is a
 * separate aggregate over all history.
 */
async function loadHistoryPage(input: ExerciseProgressionInput): Promise<ProgressionHistoryPage> {
  const limit = boundedLimit(input.limit);
  const cursor = input.cursor ? decodeExerciseHistoryCursor(input.cursor) : null;
  if (input.cursor && !cursor) {
    throw new AppError('VALIDATION', 'Cursor inválido');
  }

  const keyset = cursor
    ? (() => {
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
      })()
    : undefined;

  const rows: HistoryPageRow[] = await db
    .select({ ...SET_COLUMNS, endedAt: workouts.endedAt })
    .from(workoutSets)
    .innerJoin(workouts, eq(workouts.id, workoutSets.workoutId))
    .where(
      and(
        eq(workoutSets.exerciseId, input.exerciseId),
        eq(workouts.userId, input.userId),
        isNull(workouts.deletedAt),
        isNull(workoutSets.deletedAt),
        isNotNull(workouts.endedAt),
        keyset,
      ),
    )
    .orderBy(desc(workouts.endedAt), desc(workouts.id), asc(workoutSets.setIndex), asc(workoutSets.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const items: ProgressionHistoryItem[] = page.map((row) => ({
    setId: row.setId,
    workoutId: row.workoutId,
    setIndex: row.setIndex,
    reps: row.reps,
    weightKg: row.weightKg,
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    localDate: row.endedAt ? cordobaLocalDate(row.endedAt) : null,
    semantics: rowSemantics(row),
    setPurpose: rowPurpose(row),
    comparable: isComparable(row, input),
  }));

  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last && last.endedAt
      ? encodeExerciseHistoryCursor({
          sortAt: last.endedAt.toISOString(),
          workoutId: last.workoutId,
          setIndex: last.setIndex,
          setId: last.setId,
        })
      : null;

  return { items, nextCursor, limit, bounded: true };
}

function readStatusFor(
  hasAny: boolean,
  hasSemantic: boolean,
  hasRepresentative: boolean,
): ProgressionReadStatus {
  if (!hasAny) return 'no_history';
  if (!hasSemantic) return 'history_without_semantics';
  if (!hasRepresentative) return 'no_comparable_set';
  return 'ready';
}

function reasonsFor(status: ProgressionReadStatus): string[] {
  switch (status) {
    case 'ready':
      return ['eligible'];
    case 'no_comparable_set':
      return ['no_eligible_closed_workout'];
    case 'history_without_semantics':
      return ['unknown_semantics'];
    case 'no_history':
      return [];
  }
}

/**
 * Computes the truthful, owner-scoped progression summary for one exact cohort.
 *
 * Ordering semantics (rule v1): current = representative of the latest eligible
 * closed workout `(endedAt, workoutId)`; previous = latest earlier eligible
 * closed workout; `currentBest` = all-time maximum; `comparison` compares the
 * current representative against the exact best *before* it — never merely the
 * previous workout. History is bounded and independent of the PR answer.
 */
export async function getExerciseProgression(
  input: ExerciseProgressionInput,
): Promise<ExerciseProgression> {
  await requireAccessibleExercise(input.exerciseId, input.userId);

  const [hasAny, hasSemantic, history] = await Promise.all([
    hasAnyLiveSet(input.userId, input.exerciseId, false),
    hasAnyLiveSet(input.userId, input.exerciseId, true),
    loadHistoryPage(input),
  ]);

  const latest = await loadLatestWorkout(input);
  const currentRepresentative = latest
    ? await loadWorkoutRepresentative(input, latest.workoutId, latest.endedAt)
    : null;

  if (!latest || !currentRepresentative) {
    const status = readStatusFor(hasAny, hasSemantic, false);
    return {
      metricId: SAME_REPS_EXTERNAL_LOAD_METRIC,
      progressionRuleVersion: PROGRESSION_RULE_VERSION,
      readStatus: status,
      cohort: buildCohortKey(input),
      currentRepresentative: null,
      previousComparableRepresentative: null,
      currentBest: null,
      comparison: null,
      reasons: reasonsFor(status),
      history,
      provenance: 'atlas_computed',
    };
  }

  const canonical = buildCanonical(input);
  const previousWorkout = await loadLatestWorkout(input, latest);
  const previousRepresentative = previousWorkout
    ? await loadWorkoutRepresentative(input, previousWorkout.workoutId, previousWorkout.endedAt)
    : null;

  const [currentBest, bestBefore] = await Promise.all([
    loadCohortBest(input),
    loadCohortBest(input, latest),
  ]);
  const comparison = compareToPriorBest(
    currentRepresentative.weightKg,
    bestBefore?.weightKg ?? null,
  );

  return {
    metricId: SAME_REPS_EXTERNAL_LOAD_METRIC,
    progressionRuleVersion: PROGRESSION_RULE_VERSION,
    readStatus: 'ready',
    cohort: buildCohortKey(input),
    currentRepresentative: toSourceSet(currentRepresentative, declaredSemantics(canonical)),
    previousComparableRepresentative: previousRepresentative
      ? toSourceSet(previousRepresentative, declaredSemantics(canonical))
      : null,
    currentBest: currentBest
      ? toSourceSet(
          {
            workoutId: currentBest.workoutId,
            setId: currentBest.setId,
            setIndex: currentBest.setIndex,
            reps: currentBest.reps,
            weightKg: currentBest.weightKg,
            cohort: buildCohortKey(input),
            endedAt: currentBest.endedAt,
          },
          declaredSemantics(canonical),
        )
      : null,
    comparison,
    reasons: reasonsFor('ready'),
    history,
    provenance: 'atlas_computed',
  };
}
