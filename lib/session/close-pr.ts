import { resolveProgressionSupport } from '@/lib/session/progression-cohort';
import { SAME_REPS_EXTERNAL_LOAD_METRIC, SEMANTIC_CAPTURE_VERSION_1, PROGRESSION_RULE_VERSION } from '@/types/progression';
import type { ExerciseProgression, ProgressionSourceSet } from '@/types/progression-read';
import type { ProgressionQueryCohort } from '@/lib/api/exercise-progression';
import type { WorkoutSet } from '@/lib/db/schema';

/**
 * Close-time verified PR contract (Atlas v0.13 workstream E, brief §19).
 *
 * This module is pure and total. It never determines a PR from local weights or
 * open sets: it only derives candidate external cohorts from a just-closed
 * workout's own recorded semantics and then verifies the server read model.
 * A celebration is eligible only when every contract check below passes.
 *
 * `external` + `working` are fixed by the `same_reps_external_load` metric, so
 * the candidate shape deliberately excludes bodyweight, added, assisted, warmup
 * and alternating sets.
 */

/** Progression rule versions this client understands. Unknown versions are never celebrated. */
export const SUPPORTED_PROGRESSION_RULE_VERSIONS: readonly number[] = [PROGRESSION_RULE_VERSION];

/**
 * Bounded client-side deadline for optional post-close verification. A slow
 * query must never delay the already-successful close beyond this window.
 */
export const PR_VERIFICATION_TIMEOUT_MS = 1500;

/** The subset of a persisted set needed to derive an eligible cohort. */
export type CloseCandidateSet = Pick<
  WorkoutSet,
  | 'id'
  | 'exerciseId'
  | 'setIndex'
  | 'reps'
  | 'completed'
  | 'deletedAt'
  | 'semanticCaptureVersion'
  | 'loadMode'
  | 'amountBasis'
  | 'side'
  | 'setPurpose'
  | 'repCountBasis'
>;

/** One deduplicated external cohort to query after the workout closed. */
export interface ProgressionCandidate {
  exerciseId: number;
  cohort: ProgressionQueryCohort;
}

/** A progression result that passed the full close-time verification contract. */
export interface VerifiedProgressionEvent {
  /** Deduplication key: rule version + metric + exact cohort + source set. */
  key: string;
  exerciseId: number;
  progression: ExerciseProgression;
  /** The verified representative belonging to the just-closed workout. */
  sourceSet: ProgressionSourceSet;
}

function eligibleCohort(set: CloseCandidateSet): ProgressionCandidate | null {
  if (
    set.completed !== true ||
    set.deletedAt !== null ||
    set.semanticCaptureVersion !== SEMANTIC_CAPTURE_VERSION_1 ||
    !Number.isInteger(set.reps) ||
    set.reps <= 0
  ) {
    return null;
  }

  const support = resolveProgressionSupport({
    loadMode: set.loadMode ?? '',
    amountBasis: set.amountBasis ?? '',
    side: set.side ?? '',
    setPurpose: set.setPurpose ?? '',
    reps: set.reps,
  });
  if (support.status !== 'supported') {
    return null;
  }

  return { exerciseId: set.exerciseId, cohort: support.cohort };
}

/**
 * Derives candidate external cohorts from the just-closed workout's own sets.
 *
 * Ordering is deterministic: sets are visited by ascending `setIndex` and only
 * the first occurrence of an identical cohort is kept, so presentation never
 * invents a ranking between records.
 */
export function deriveEligibleCohorts(sets: readonly CloseCandidateSet[]): ProgressionCandidate[] {
  const ordered = [...sets]
    .map((set) => ({ set, candidate: eligibleCohort(set) }))
    .filter((entry): entry is { set: CloseCandidateSet; candidate: ProgressionCandidate } => entry.candidate !== null)
    .sort((a, b) => a.set.setIndex - b.set.setIndex);

  const seen = new Set<string>();
  const candidates: ProgressionCandidate[] = [];
  for (const { candidate } of ordered) {
    const key = cohortKey(candidate.exerciseId, candidate.cohort);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    candidates.push(candidate);
  }
  return candidates;
}

function cohortKey(exerciseId: number, cohort: ProgressionQueryCohort): string {
  return `${exerciseId}:${cohort.reps}:${cohort.amountBasis}:${cohort.side}`;
}

/** Stable event identity used by the in-memory and sessionStorage guards. */
export function buildProgressionEventKey(data: ExerciseProgression): string {
  const { cohort } = data;
  return [
    data.progressionRuleVersion,
    data.metricId,
    cohort.exerciseId,
    cohort.reps,
    cohort.amountBasis,
    cohort.side,
    data.currentRepresentative?.setId ?? 'none',
  ].join(':');
}

export interface VerifyProgressionInput {
  exerciseId: number;
  cohort: ProgressionQueryCohort;
  workoutId: number;
  /** Ids of every set recorded in the just-closed workout. */
  closedSetIds: ReadonlySet<number>;
}

/**
 * Defense-in-depth around the server truth. Returns the verified event only when
 * ALL of the brief §19 conditions hold; otherwise returns `null`.
 */
export function verifyProgressionResult(
  data: ExerciseProgression,
  input: VerifyProgressionInput,
): VerifiedProgressionEvent | null {
  if (data.readStatus !== 'ready') {
    return null;
  }
  if (data.comparison !== 'new_pr') {
    return null;
  }
  if (data.metricId !== SAME_REPS_EXTERNAL_LOAD_METRIC) {
    return null;
  }
  if (!SUPPORTED_PROGRESSION_RULE_VERSIONS.includes(data.progressionRuleVersion)) {
    return null;
  }

  const { cohort } = data;
  if (
    cohort.exerciseId !== input.exerciseId ||
    cohort.loadMode !== 'external' ||
    cohort.reps !== input.cohort.reps ||
    cohort.amountBasis !== input.cohort.amountBasis ||
    cohort.side !== input.cohort.side
  ) {
    return null;
  }

  const current = data.currentRepresentative;
  const previous = data.previousComparableRepresentative;
  if (!current || !previous) {
    return null;
  }
  if (current.workoutId !== input.workoutId) {
    return null;
  }
  if (!input.closedSetIds.has(current.setId)) {
    return null;
  }

  return {
    key: buildProgressionEventKey(data),
    exerciseId: input.exerciseId,
    progression: data,
    sourceSet: current,
  };
}

export interface FindVerifiedClosePrInput {
  workoutId: number;
  closedSetIds: ReadonlySet<number>;
  candidates: readonly ProgressionCandidate[];
  fetchProgression: (
    exerciseId: number,
    cohort: ProgressionQueryCohort,
  ) => Promise<ExerciseProgression>;
  timeoutMs?: number;
  now?: () => number;
}

/**
 * Queries candidate cohorts within one bounded deadline and returns the first
 * verified PR in deterministic candidate order, or `null`. Network errors,
 * malformed bodies and timeouts are swallowed: the workout close already
 * succeeded and must not be affected by optional feedback.
 */
export async function findVerifiedClosePr(
  input: FindVerifiedClosePrInput,
): Promise<VerifiedProgressionEvent | null> {
  const timeoutMs = input.timeoutMs ?? PR_VERIFICATION_TIMEOUT_MS;
  const now = input.now ?? (() => Date.now());
  const deadline = now() + timeoutMs;

  for (const candidate of input.candidates) {
    const remaining = deadline - now();
    if (remaining <= 0) {
      return null;
    }
    const data = await settleWithin(input.fetchProgression(candidate.exerciseId, candidate.cohort), remaining);
    if (!data) {
      continue;
    }
    const event = verifyProgressionResult(data, {
      exerciseId: candidate.exerciseId,
      cohort: candidate.cohort,
      workoutId: input.workoutId,
      closedSetIds: input.closedSetIds,
    });
    if (event) {
      return event;
    }
  }

  return null;
}

/** Resolves the value, or `null` on rejection/timeout. Never rejects. */
function settleWithin<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}
