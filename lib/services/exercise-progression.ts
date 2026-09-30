import { and, eq, isNotNull, isNull } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { workouts, workoutSets } from '@/lib/db/schema';
import {
  decodeExerciseHistoryCursor,
  encodeExerciseHistoryCursor,
} from '@/lib/db/keyset-cursor';
import {
  boundedProgressionHistoryQuery,
  cohortCandidatesQuery,
  latestCohortWorkoutsQuery,
  workoutCohortRowsQuery,
  PROGRESSION_CANDIDATE_LIMIT,
} from '@/lib/db/progression-queries';
import type { ProgressionCohortFilters as CohortFilters } from '@/lib/db/progression-queries';
import { requireAccessibleExercise } from '@/lib/services/exercises';
import { compareToPriorBest, selectWorkoutRepresentative } from '@/lib/progression';
import { canonicalSemantics, classifyEligibility } from '@/lib/progression/semantics';
import { cordobaLocalDate } from '@/lib/time/cordoba';
import { PROGRESSION_RULE_VERSION, SAME_REPS_EXTERNAL_LOAD_METRIC } from '@/types/progression';
import { AppError } from '@/types/errors';
import type {
  AmountBasis,
  CanonicalSemantics,
  CohortKey,
  EligibleSet,
  ProgressionComparison,
  ProgressionObservation,
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
import type { ProgressionSide } from '@/lib/db/progression-queries';

export type { ProgressionSide } from '@/lib/db/progression-queries';

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

interface EvidenceRow {
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
  endedAt: Date | null;
}

/** A row that canonicalizes under a registered capture version. */
interface CanonicalRow {
  row: EvidenceRow;
  canonical: CanonicalSemantics;
  version: number;
}

function toFilters(input: ExerciseProgressionInput): CohortFilters {
  return {
    exerciseId: input.exerciseId,
    userId: input.userId,
    reps: input.reps,
    amountBasis: input.amountBasis,
    side: input.side,
  };
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

function toObservation(row: EvidenceRow): ProgressionObservation {
  return {
    setId: row.setId,
    workoutId: row.workoutId,
    exerciseId: row.exerciseId,
    setIndex: row.setIndex,
    reps: row.reps,
    weightKg: row.weightKg,
    completed: row.completed,
    setDeleted: false,
    workoutEndedAt: row.endedAt,
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
  };
}

/**
 * Canonicalizes a raw row through the registered capture-version mapping.
 * Returns `null` for unknown/unsupported versions or corrupt tuples, so an
 * incompatible capture version can never enter a comparison cohort (§9b).
 */
function canonicalRow(row: EvidenceRow): CanonicalRow | null {
  const result = canonicalSemantics(row.semanticCaptureVersion, {
    loadMode: row.loadMode,
    amountBasis: row.amountBasis,
    side: row.side,
    setPurpose: row.setPurpose,
    repCountBasis: row.repCountBasis,
  });
  if (result.status !== 'canonical' || row.semanticCaptureVersion === null) {
    return null;
  }
  return { row, canonical: result.tuple, version: row.semanticCaptureVersion };
}

/**
 * A candidate belongs to the requested cohort when the pure domain classifies
 * the observation ELIGIBLE (lifecycle + canonical amount) and its canonical
 * tuple matches the requested basis/side/reps.
 */
function eligibleCanonicalRow(
  row: EvidenceRow,
  filters: CohortFilters,
): CanonicalRow | null {
  const canonical = canonicalRow(row);
  if (!canonical) {
    return null;
  }
  const tuple = canonical.canonical;
  if (
    tuple.loadMode !== 'external' ||
    tuple.setPurpose !== 'working' ||
    tuple.amountBasis !== filters.amountBasis ||
    tuple.side !== filters.side ||
    row.reps !== filters.reps
  ) {
    return null;
  }
  if (classifyEligibility(toObservation(row)).status !== 'ELIGIBLE') {
    return null;
  }
  return canonical;
}

function declaredSemantics(canonical: CanonicalSemantics, version: number): ProgressionSemantics {
  return {
    semanticCaptureVersion: version,
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

interface WorkoutRepresentativeResult {
  representative: WorkoutRepresentative;
  semantics: ProgressionSemantics;
}

/** Representative of a specific closed workout within the cohort, or null. */
async function loadWorkoutRepresentative(
  filters: CohortFilters,
  workoutId: number,
  endedAt: Date,
): Promise<WorkoutRepresentativeResult | null> {
  const rows: EvidenceRow[] = await workoutCohortRowsQuery(filters, workoutId);

  const eligible: EligibleSet[] = [];
  const semanticsById = new Map<number, ProgressionSemantics>();
  for (const row of rows) {
    const canonical = eligibleCanonicalRow(row, filters);
    if (!canonical) {
      continue;
    }
    eligible.push({
      observation: toObservation(row),
      canonical: canonical.canonical,
      cohort: {
        exerciseId: filters.exerciseId,
        loadMode: 'external',
        amountBasis: filters.amountBasis,
        side: filters.side,
        reps: filters.reps,
      },
    });
    semanticsById.set(row.setId, declaredSemantics(canonical.canonical, canonical.version));
  }

  const representative = selectWorkoutRepresentative(eligible);
  if (!representative) {
    return null;
  }
  const semantics = semanticsById.get(representative.setId);
  if (!semantics) {
    return null;
  }
  return { representative, semantics };
}

/**
 * Latest *eligible* closed workout in the cohort. Candidate workouts come from
 * the raw cohort filter (indexed, latest first); each is then verified through
 * the pure domain, so a workout holding only incompatible/non-canonical rows is
 * skipped rather than reported as the current result.
 */
async function loadLatestEligibleWorkout(
  filters: CohortFilters,
  prior?: { endedAt: Date; workoutId: number },
): Promise<{ workoutId: number; endedAt: Date; representative: WorkoutRepresentativeResult } | null> {
  const workoutRows = await latestCohortWorkoutsQuery(filters, prior);
  for (const row of workoutRows) {
    if (!row.endedAt) {
      continue;
    }
    const representative = await loadWorkoutRepresentative(filters, row.workoutId, row.endedAt);
    if (representative) {
      return { workoutId: row.workoutId, endedAt: row.endedAt, representative };
    }
  }
  return null;
}

interface CohortBest {
  row: EvidenceRow;
  semantics: ProgressionSemantics;
}

/**
 * Exact decimal-max cohort aggregate. The SQL order is decimal-exact; the pure
 * domain then skips any non-canonical/incompatible candidate, so the returned
 * best is both the highest and genuinely comparable.
 */
async function loadCohortBest(
  filters: CohortFilters,
  prior?: { endedAt: Date; workoutId: number },
): Promise<CohortBest | null> {
  const rows: EvidenceRow[] = await cohortCandidatesQuery(
    filters,
    prior,
    PROGRESSION_CANDIDATE_LIMIT,
  );
  for (const row of rows) {
    const canonical = eligibleCanonicalRow(row, filters);
    if (canonical) {
      return { row, semantics: declaredSemantics(canonical.canonical, canonical.version) };
    }
  }
  return null;
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

function boundedLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1) {
    return DEFAULT_PROGRESSION_HISTORY_LIMIT;
  }
  return Math.min(limit, MAX_PROGRESSION_HISTORY_LIMIT);
}

/**
 * Bounded, keyset history page over the exact exercise's closed workouts. The
 * page limit never influences the PR/best result, which is a separate aggregate
 * over all history.
 */
async function loadHistoryPage(input: ExerciseProgressionInput): Promise<ProgressionHistoryPage> {
  const limit = boundedLimit(input.limit);
  const cursor = input.cursor ? decodeExerciseHistoryCursor(input.cursor) : null;
  if (input.cursor && !cursor) {
    throw new AppError('VALIDATION', 'Cursor inválido');
  }

  const rows: EvidenceRow[] = await boundedProgressionHistoryQuery(
    { exerciseId: input.exerciseId, userId: input.userId },
    cursor,
    limit,
  );

  const filters = toFilters(input);
  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const items: ProgressionHistoryItem[] = page.map((row) => {
    const canonical = canonicalRow(row);
    const eligible = canonical ? eligibleCanonicalRow(row, filters) !== null : false;
    return {
      setId: row.setId,
      workoutId: row.workoutId,
      setIndex: row.setIndex,
      reps: row.reps,
      weightKg: row.weightKg,
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
      localDate: row.endedAt ? cordobaLocalDate(row.endedAt) : null,
      semantics: canonical ? declaredSemantics(canonical.canonical, canonical.version) : null,
      setPurpose: canonical ? canonical.canonical.setPurpose : null,
      comparable: eligible,
    };
  });

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
  const filters = toFilters(input);

  const [hasAny, hasSemantic, history] = await Promise.all([
    hasAnyLiveSet(input.userId, input.exerciseId, false),
    hasAnyLiveSet(input.userId, input.exerciseId, true),
    loadHistoryPage(input),
  ]);

  const latest = await loadLatestEligibleWorkout(filters);

  if (!latest) {
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

  const current = latest.representative;
  const previousEligible = await loadLatestEligibleWorkout(filters, latest);
  const previous = previousEligible?.representative ?? null;

  const [currentBest, bestBefore] = await Promise.all([
    loadCohortBest(filters),
    loadCohortBest(filters, { endedAt: latest.endedAt, workoutId: latest.workoutId }),
  ]);
  const comparison: ProgressionComparison = compareToPriorBest(
    current.representative.weightKg,
    bestBefore?.row.weightKg ?? null,
  );

  return {
    metricId: SAME_REPS_EXTERNAL_LOAD_METRIC,
    progressionRuleVersion: PROGRESSION_RULE_VERSION,
    readStatus: 'ready',
    cohort: buildCohortKey(input),
    currentRepresentative: toSourceSet(current.representative, current.semantics),
    previousComparableRepresentative: previous
      ? toSourceSet(previous.representative, previous.semantics)
      : null,
    currentBest: currentBest
      ? toSourceSet(
          {
            workoutId: currentBest.row.workoutId,
            setId: currentBest.row.setId,
            setIndex: currentBest.row.setIndex,
            reps: currentBest.row.reps,
            weightKg: currentBest.row.weightKg,
            cohort: buildCohortKey(input),
            endedAt: currentBest.row.endedAt ?? latest.endedAt,
          },
          currentBest.semantics,
        )
      : null,
    comparison,
    reasons: reasonsFor('ready'),
    history,
    provenance: 'atlas_computed',
  };
}
