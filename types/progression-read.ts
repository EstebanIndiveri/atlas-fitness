import type {
  AmountBasis,
  LoadMode,
  ProgressionComparison,
  RepCountBasis,
  SetPurpose,
  Side,
} from '@/types/progression';

/**
 * Truthful, bounded progression read model (Atlas Fitness v0.12, Workstream D).
 *
 * A result is always derived from recorded facts and the pure domain; unknown
 * or absent values are `null`, never zero. `progressionRuleVersion` names the
 * algorithm, `metricId` names the comparison, and every source set keeps its
 * capture semantics and provenance.
 */

export type ProgressionReadStatus =
  | 'no_history'
  | 'history_without_semantics'
  | 'no_comparable_set'
  | 'ready';

export type ProgressionMetricId = 'same_reps_external_load';

/** Declared semantics of a captured v1 set. */
export interface ProgressionSemantics {
  semanticCaptureVersion: number;
  loadMode: LoadMode;
  amountBasis: AmountBasis | null;
  side: Side;
  setPurpose: SetPurpose;
  repCountBasis: RepCountBasis | null;
}

/** The exact comparison cohort selected by the query. */
export interface ProgressionCohort {
  exerciseId: number;
  loadMode: 'external';
  amountBasis: AmountBasis;
  side: 'bilateral' | 'left' | 'right';
  reps: number;
}

/** A selected source set (representative or best), with display context. */
export interface ProgressionSourceSet {
  setId: number;
  workoutId: number;
  setIndex: number;
  reps: number;
  weightKg: string;
  /** ISO timestamp of the owning closed workout. */
  endedAt: string;
  /** Córdoba local date (`YYYY-MM-DD`) for display only. */
  localDate: string;
  semantics: ProgressionSemantics;
  provenance: 'user_input';
}

/** One raw, bounded history observation; legacy rows carry `semantics: null`. */
export interface ProgressionHistoryItem {
  setId: number;
  workoutId: number;
  setIndex: number;
  reps: number;
  weightKg: string;
  endedAt: string | null;
  localDate: string | null;
  semantics: ProgressionSemantics | null;
  setPurpose: SetPurpose | null;
  /** Whether this observation is eligible for the requested cohort. */
  comparable: boolean;
}

export interface ProgressionHistoryPage {
  items: ProgressionHistoryItem[];
  nextCursor: string | null;
  limit: number;
  bounded: true;
}

export interface ExerciseProgression {
  metricId: ProgressionMetricId;
  progressionRuleVersion: number;
  readStatus: ProgressionReadStatus;
  cohort: ProgressionCohort;
  currentRepresentative: ProgressionSourceSet | null;
  previousComparableRepresentative: ProgressionSourceSet | null;
  currentBest: ProgressionSourceSet | null;
  comparison: ProgressionComparison | null;
  reasons: string[];
  history: ProgressionHistoryPage;
  provenance: 'atlas_computed';
}
