import type { AmountBasis, Side } from '@/types/progression';

/**
 * Progression cohort selection (Atlas v0.12, Workstream F).
 *
 * The comparable PR surface only exists for the `same_reps_external_load`
 * metric: a declared `external` working set on a supported side (`bilateral`,
 * `left`, `right`) with an explicit amount basis and a positive rep count.
 * Everything else is truthfully non-comparable for v0.12 and must not
 * manufacture a query. This module is pure and total over its inputs.
 */

/** The exact external cohort the current visible context can compare. */
export interface ProgressionCohortRequest {
  reps: number;
  amountBasis: AmountBasis;
  side: Extract<Side, 'bilateral' | 'left' | 'right'>;
}

/** Why the current visible context has no comparable external cohort. */
export type ProgressionUnsupportedReason =
  | 'missing_selection'
  | 'invalid_reps'
  | 'warmup'
  | 'unsupported_load_mode'
  | 'alternating';

export type ProgressionSupport =
  | { status: 'supported'; cohort: ProgressionCohortRequest }
  | { status: 'unsupported'; reason: ProgressionUnsupportedReason };

/** The visible capture choices the current set would be saved with. */
export interface ProgressionSupportInput {
  loadMode: string;
  amountBasis: string;
  side: string;
  setPurpose: string;
  reps: number;
}

function isSupportedSide(
  side: string,
): side is ProgressionCohortRequest['side'] {
  return side === 'bilateral' || side === 'left' || side === 'right';
}

/**
 * Resolves whether the current visible semantic context yields a valid external
 * comparable cohort. Returns a typed reason instead of a query when it does
 * not; it never infers semantics from exercise name, equipment or history.
 */
export function resolveProgressionSupport(input: ProgressionSupportInput): ProgressionSupport {
  const { loadMode, amountBasis, side, setPurpose, reps } = input;

  if (!loadMode || !side || !setPurpose) {
    return { status: 'unsupported', reason: 'missing_selection' };
  }
  if (!Number.isInteger(reps) || reps <= 0) {
    return { status: 'unsupported', reason: 'invalid_reps' };
  }
  if (setPurpose === 'warmup') {
    return { status: 'unsupported', reason: 'warmup' };
  }
  if (setPurpose !== 'working') {
    // Only an explicit working purpose is comparable; anything unexpected is
    // treated as an incomplete selection rather than silently accepted.
    return { status: 'unsupported', reason: 'missing_selection' };
  }
  if (loadMode !== 'external') {
    return { status: 'unsupported', reason: 'unsupported_load_mode' };
  }
  if (side === 'alternating') {
    return { status: 'unsupported', reason: 'alternating' };
  }
  if (!isSupportedSide(side) || (amountBasis !== 'total' && amountBasis !== 'per_side')) {
    return { status: 'unsupported', reason: 'missing_selection' };
  }

  return { status: 'supported', cohort: { reps, amountBasis, side } };
}
