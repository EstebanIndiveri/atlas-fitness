/**
 * Progression Foundation domain contract (Atlas Fitness v0.12).
 *
 * These types describe recorded set facts and the claims computed from them.
 * They are pure: no database, HTTP, React or Telegram concerns live here.
 * A persisted observation keeps its raw `weightKg` decimal string; comparability
 * is decided from an explicit canonical semantic tuple, never from float math
 * and never from capture-version equality.
 */

/** How external resistance relates to the movement. Recorded, never inferred. */
export type LoadMode = 'external' | 'bodyweight' | 'bodyweight_added' | 'assisted';

/** Counting convention of the recorded amount, independent of load mode. */
export type AmountBasis = 'total' | 'per_side';

/** Which side(s) the set describes. `alternating` requires a rep-count basis. */
export type Side = 'bilateral' | 'left' | 'right' | 'alternating';

/** User-declared purpose. Legacy rows store no value (unknown). */
export type SetPurpose = 'working' | 'warmup';

/** What the entered reps count for an `alternating` set. */
export type RepCountBasis = 'total' | 'per_side';

/** All supported load modes, for membership checks and iteration. */
export const LOAD_MODES: readonly LoadMode[] = [
  'external',
  'bodyweight',
  'bodyweight_added',
  'assisted',
];

/** All supported amount bases. */
export const AMOUNT_BASES: readonly AmountBasis[] = ['total', 'per_side'];

/** All supported sides. */
export const SIDES: readonly Side[] = ['bilateral', 'left', 'right', 'alternating'];

/** All supported set purposes. */
export const SET_PURPOSES: readonly SetPurpose[] = ['working', 'warmup'];

/** All supported rep-count bases. */
export const REP_COUNT_BASES: readonly RepCountBasis[] = ['total', 'per_side'];

/** Capture-version registry key for the v1 semantic meaning contract. */
export const SEMANTIC_CAPTURE_VERSION_1 = 1;

/** Version of the eligibility/comparison algorithm; computed, never persisted. */
export const PROGRESSION_RULE_VERSION = 1;

/** Identifier of the MVP metric: same exact exercise, same reps, external load. */
export const SAME_REPS_EXTERNAL_LOAD_METRIC = 'same_reps_external_load';

/**
 * Canonical semantic tuple. Compatible observations share a tuple regardless of
 * the capture version that produced them; the tuple deliberately omits version.
 */
export interface CanonicalSemantics {
  loadMode: LoadMode;
  amountBasis: AmountBasis | null;
  side: Side;
  setPurpose: SetPurpose;
  repCountBasis: RepCountBasis | null;
}

/** Raw persisted semantic columns; all-null means legacy/unknown. */
export interface RawSemanticFields {
  semanticCaptureVersion: number | null;
  loadMode: string | null;
  amountBasis: string | null;
  side: string | null;
  setPurpose: string | null;
  repCountBasis: string | null;
}

/** Why a tuple cannot be canonicalized for the named metric. */
export type SemanticUnknownReason =
  | 'unknown_semantics'
  | 'unsupported_capture_version'
  | 'invalid_semantic_combination';

/** Why a canonical set is excluded from the external-load metric. */
export type SemanticIneligibleReason =
  | 'warmup'
  | 'unsupported_load_mode'
  | 'unsupported_side'
  | 'open_workout'
  | 'incomplete_set'
  | 'deleted_set'
  | 'deleted_workout'
  | 'exercise_unavailable'
  | 'invalid_amount';

/** Union of every public eligibility reason code. */
export type EligibilityReason =
  | 'eligible'
  | SemanticUnknownReason
  | SemanticIneligibleReason;

/** Discriminated result of `classifyEligibility` for the external-load metric. */
export type EligibilityResult =
  | { status: 'ELIGIBLE'; reason: 'eligible' }
  | { status: 'UNKNOWN'; reason: SemanticUnknownReason }
  | { status: 'INELIGIBLE'; reason: SemanticIneligibleReason };

/** A persisted set and its lifecycle/ownership facts, before any claim. */
export interface ProgressionObservation {
  setId: number;
  workoutId: number;
  exerciseId: number;
  setIndex: number;
  reps: number;
  weightKg: string;
  completed: boolean;
  setDeleted: boolean;
  workoutEndedAt: Date | null;
  workoutDeleted: boolean;
  exerciseAvailable: boolean;
  semantics: RawSemanticFields;
}

/** Result of mapping a raw persisted tuple to the canonical vocabulary. */
export type CanonicalizationResult =
  | { status: 'canonical'; tuple: CanonicalSemantics }
  | { status: 'unknown'; reason: SemanticUnknownReason };

/** Input for validating a brand-new v1 semantic write. */
export interface SemanticCaptureInput {
  semanticCaptureVersion: number | null;
  loadMode: string | null;
  amountBasis: string | null;
  side: string | null;
  setPurpose: string | null;
  repCountBasis: string | null;
  weightKg: string;
  reps: number;
}

/** Whether a valid-to-record set is eligible for the external-load metric. */
export type CaptureOutcome = 'valid' | 'recorded_not_comparable';

/** Result of validating a new semantic capture. */
export type SemanticCaptureValidation =
  | { ok: true; outcome: CaptureOutcome; canonical: CanonicalSemantics }
  | { ok: false; reason: SemanticUnknownReason | 'invalid_amount' };

/**
 * Comparison key for the MVP metric. `loadMode` is fixed to `external` and
 * `side` excludes `alternating`; amounts are never normalized across bases.
 */
export interface CohortKey {
  exerciseId: number;
  loadMode: 'external';
  amountBasis: AmountBasis;
  side: 'bilateral' | 'left' | 'right';
  reps: number;
}

/** A canonicalized set that passed eligibility for the external-load metric. */
export interface EligibleSet {
  observation: ProgressionObservation;
  canonical: CanonicalSemantics;
  cohort: CohortKey;
}

/** The single set representing a closed workout within one cohort. */
export interface WorkoutRepresentative {
  workoutId: number;
  setId: number;
  setIndex: number;
  reps: number;
  weightKg: string;
  cohort: CohortKey;
  endedAt: Date;
}

/** Classification of a workout representative against earlier closed workouts. */
export type ProgressionComparison = 'baseline' | 'new_pr' | 'ties_best' | 'below_best';
