import {
  AMOUNT_BASES,
  LOAD_MODES,
  REP_COUNT_BASES,
  SET_PURPOSES,
  SIDES,
} from '@/types/progression';
import type {
  CanonicalSemantics,
  CanonicalizationResult,
  CaptureOutcome,
  CohortKey,
  EligibilityResult,
  ProgressionObservation,
  RawSemanticFields,
  SemanticCaptureInput,
  SemanticCaptureValidation,
} from '@/types/progression';
import { isCanonicalPositiveDecimal, isZeroDecimal, normalizeExactDecimal } from './decimal';

/** Raw semantic fields minus the version selector handled by `canonicalSemantics`. */
type SemanticFields = Omit<RawSemanticFields, 'semanticCaptureVersion'>;

/** Supported external sides for the MVP metric; `alternating` is excluded. */
type ExternalSide = Extract<CanonicalSemantics['side'], 'bilateral' | 'left' | 'right'>;

/** Maps one capture version's raw fields to a canonical tuple. */
type SemanticFieldMapper = (fields: SemanticFields) => CanonicalizationResult;

function isMember<T extends string>(allowed: readonly T[], value: string): value is T {
  return allowed.some((entry) => entry === value);
}

function isExternalSide(side: CanonicalSemantics['side']): side is ExternalSide {
  return side === 'bilateral' || side === 'left' || side === 'right';
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/**
 * Structural rules shared by every capture version:
 * - plain bodyweight carries no amount basis; every other mode requires one;
 * - a `left`/`right` amount is a `total`, never `per_side`;
 * - `alternating` requires a rep-count basis; no other side may carry one.
 */
function isValidAxisCombination(tuple: CanonicalSemantics): boolean {
  const { loadMode, amountBasis, side, repCountBasis } = tuple;

  if (loadMode === 'bodyweight') {
    if (amountBasis !== null) {
      return false;
    }
  } else {
    if (amountBasis === null) {
      return false;
    }
    if ((side === 'left' || side === 'right') && amountBasis !== 'total') {
      return false;
    }
  }

  if (side === 'alternating') {
    return repCountBasis !== null;
  }
  return repCountBasis === null;
}

function mapCaptureVersion1(fields: SemanticFields): CanonicalizationResult {
  const { loadMode, amountBasis, side, setPurpose, repCountBasis } = fields;

  if (loadMode === null || side === null || setPurpose === null) {
    return { status: 'unknown', reason: 'unknown_semantics' };
  }
  if (!isMember(LOAD_MODES, loadMode) || !isMember(SIDES, side) || !isMember(SET_PURPOSES, setPurpose)) {
    return { status: 'unknown', reason: 'invalid_semantic_combination' };
  }
  if (amountBasis !== null && !isMember(AMOUNT_BASES, amountBasis)) {
    return { status: 'unknown', reason: 'invalid_semantic_combination' };
  }
  if (repCountBasis !== null && !isMember(REP_COUNT_BASES, repCountBasis)) {
    return { status: 'unknown', reason: 'invalid_semantic_combination' };
  }

  const tuple: CanonicalSemantics = { loadMode, amountBasis, side, setPurpose, repCountBasis };
  if (!isValidAxisCombination(tuple)) {
    return { status: 'unknown', reason: 'invalid_semantic_combination' };
  }
  return { status: 'canonical', tuple };
}

/**
 * The single extension point for capture-version compatibility. Only version 1
 * is registered; a future version 2 must be added here (with equivalence proof
 * and test vectors) without rewriting historical rows. Unknown versions yield
 * `unsupported_capture_version`.
 */
export const CAPTURE_VERSION_MAPPINGS: Readonly<Record<number, SemanticFieldMapper>> =
  Object.freeze({ 1: mapCaptureVersion1 });

/**
 * Compatible-version boundary: maps `(captureVersion, raw fields)` to a
 * canonical tuple or a typed unknown. Comparability is defined by the returned
 * tuple, never by capture-version equality.
 */
export function canonicalSemantics(
  version: number | null,
  fields: SemanticFields,
): CanonicalizationResult {
  if (version === null) {
    return { status: 'unknown', reason: 'unknown_semantics' };
  }
  const mapper = CAPTURE_VERSION_MAPPINGS[version];
  if (!mapper) {
    return { status: 'unknown', reason: 'unsupported_capture_version' };
  }
  return mapper(fields);
}

/**
 * Validates a brand-new v1 semantic write: structural canonicalization plus
 * mode-aware amount and positive-integer reps checks. Returns `valid` only for
 * an external, working set on a supported side; every other valid-to-record row
 * is `recorded_not_comparable`.
 */
export function validateSemanticCapture(input: SemanticCaptureInput): SemanticCaptureValidation {
  const { semanticCaptureVersion, weightKg, reps, ...fields } = input;

  const canonical = canonicalSemantics(semanticCaptureVersion, fields);
  if (canonical.status === 'unknown') {
    return { ok: false, reason: canonical.reason };
  }

  if (!isPositiveInteger(reps)) {
    return { ok: false, reason: 'invalid_amount' };
  }

  if (canonical.tuple.loadMode === 'bodyweight') {
    if (!isZeroDecimal(weightKg) || normalizeExactDecimal(weightKg) !== '0') {
      return { ok: false, reason: 'invalid_amount' };
    }
  } else if (!isCanonicalPositiveDecimal(weightKg)) {
    return { ok: false, reason: 'invalid_amount' };
  }

  const outcome: CaptureOutcome =
    canonical.tuple.loadMode === 'external' &&
    canonical.tuple.setPurpose === 'working' &&
    isExternalSide(canonical.tuple.side)
      ? 'valid'
      : 'recorded_not_comparable';

  return { ok: true, outcome, canonical: canonical.tuple };
}

/**
 * Classifies an observation for the `same_reps_external_load` metric. Ownership
 * and authorization are enforced at the API boundary, so only lifecycle, semantic
 * and amount facts are evaluated here.
 */
export function classifyEligibility(observation: ProgressionObservation): EligibilityResult {
  if (observation.workoutDeleted) {
    return { status: 'INELIGIBLE', reason: 'deleted_workout' };
  }
  if (observation.workoutEndedAt === null) {
    return { status: 'INELIGIBLE', reason: 'open_workout' };
  }
  if (observation.setDeleted) {
    return { status: 'INELIGIBLE', reason: 'deleted_set' };
  }
  if (!observation.completed) {
    return { status: 'INELIGIBLE', reason: 'incomplete_set' };
  }
  if (!observation.exerciseAvailable) {
    return { status: 'INELIGIBLE', reason: 'exercise_unavailable' };
  }

  const { semanticCaptureVersion, ...fields } = observation.semantics;
  const canonical = canonicalSemantics(semanticCaptureVersion, fields);
  if (canonical.status === 'unknown') {
    return { status: 'UNKNOWN', reason: canonical.reason };
  }

  const tuple = canonical.tuple;
  if (!isPositiveInteger(observation.reps)) {
    return { status: 'INELIGIBLE', reason: 'invalid_amount' };
  }
  if (tuple.loadMode === 'bodyweight') {
    if (!isZeroDecimal(observation.weightKg)) {
      return { status: 'INELIGIBLE', reason: 'invalid_amount' };
    }
  } else if (!isCanonicalPositiveDecimal(observation.weightKg)) {
    return { status: 'INELIGIBLE', reason: 'invalid_amount' };
  }

  if (tuple.setPurpose === 'warmup') {
    return { status: 'INELIGIBLE', reason: 'warmup' };
  }
  if (tuple.loadMode !== 'external') {
    return { status: 'INELIGIBLE', reason: 'unsupported_load_mode' };
  }
  if (tuple.side === 'alternating') {
    return { status: 'INELIGIBLE', reason: 'unsupported_side' };
  }
  return { status: 'ELIGIBLE', reason: 'eligible' };
}

/**
 * Builds the MVP comparison key from the canonical tuple. Returns `null` for any
 * tuple outside the external, based, non-alternating metric.
 */
export function cohortKey(input: {
  exerciseId: number;
  reps: number;
  canonical: CanonicalSemantics;
}): CohortKey | null {
  const { loadMode, amountBasis, side } = input.canonical;
  if (loadMode !== 'external' || amountBasis === null || !isExternalSide(side)) {
    return null;
  }
  return {
    exerciseId: input.exerciseId,
    loadMode: 'external',
    amountBasis,
    side,
    reps: input.reps,
  };
}
