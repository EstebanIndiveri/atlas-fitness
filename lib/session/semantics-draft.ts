import { validateSemanticCapture } from '@/lib/progression/semantics';
import type {
  AmountBasis,
  LoadMode,
  RepCountBasis,
  SemanticCaptureInput,
  SemanticCaptureValidation,
  SetPurpose,
  Side,
} from '@/types/progression';

/**
 * Local, visible capture draft for the guided session (v0.12).
 *
 * The draft is a UI convenience only: empty string means "not chosen yet" and
 * never silently defaults to a PR-eligible value. It is validated with the same
 * pure domain function the API uses, so the save gate cannot drift from the
 * server contract. A draft may be prefilled from the last explicitly confirmed
 * set of the same exercise, but it stays visible, editable and is persisted
 * again explicitly.
 */
export interface SemanticDraft {
  loadMode: LoadMode | '';
  amountBasis: AmountBasis | '';
  side: Side | '';
  setPurpose: SetPurpose | '';
  repCountBasis: RepCountBasis | '';
}

export const EMPTY_SEMANTIC_DRAFT: SemanticDraft = {
  loadMode: '',
  amountBasis: '',
  side: '',
  setPurpose: '',
  repCountBasis: '',
};

/** The subset of a persisted set needed to restore an explicit draft. */
export interface ConfirmedSemanticSet {
  loadMode: string | null;
  amountBasis: string | null;
  side: string | null;
  setPurpose: string | null;
  repCountBasis: string | null;
}

const LOAD_MODE_VALUES: readonly LoadMode[] = ['external', 'bodyweight', 'bodyweight_added', 'assisted'];
const AMOUNT_BASIS_VALUES: readonly AmountBasis[] = ['total', 'per_side'];
const SIDE_VALUES: readonly Side[] = ['bilateral', 'left', 'right', 'alternating'];
const SET_PURPOSE_VALUES: readonly SetPurpose[] = ['working', 'warmup'];
const REP_COUNT_BASIS_VALUES: readonly RepCountBasis[] = ['total', 'per_side'];

function asMember<T extends string>(allowed: readonly T[], value: string | null): T | '' {
  if (value === null) {
    return '';
  }
  return allowed.some((entry) => entry === value) ? (value as T) : '';
}

/**
 * Restores a draft from a persisted v1 set. Legacy rows (all-null) produce an
 * empty draft rather than an inferred default.
 */
export function draftFromConfirmedSet(set: ConfirmedSemanticSet): SemanticDraft {
  return {
    loadMode: asMember(LOAD_MODE_VALUES, set.loadMode),
    amountBasis: asMember(AMOUNT_BASIS_VALUES, set.amountBasis),
    side: asMember(SIDE_VALUES, set.side),
    setPurpose: asMember(SET_PURPOSE_VALUES, set.setPurpose),
    repCountBasis: asMember(REP_COUNT_BASIS_VALUES, set.repCountBasis),
  };
}

/** Clears any choice now incompatible with the selected load mode. */
export function applyLoadMode(draft: SemanticDraft, loadMode: LoadMode): SemanticDraft {
  const next: SemanticDraft = { ...draft, loadMode };
  if (loadMode === 'bodyweight') {
    next.amountBasis = '';
  } else if (next.amountBasis === 'per_side' && (next.side === 'left' || next.side === 'right')) {
    next.amountBasis = '';
  }
  if (next.side !== 'alternating') {
    next.repCountBasis = '';
  }
  return next;
}

/** Clears any choice now incompatible with the selected side. */
export function applySide(draft: SemanticDraft, side: Side): SemanticDraft {
  const next: SemanticDraft = { ...draft, side };
  if (side !== 'alternating') {
    next.repCountBasis = '';
  }
  if ((side === 'left' || side === 'right') && next.amountBasis === 'per_side') {
    next.amountBasis = '';
  }
  return next;
}

/**
 * Maps a complete draft to the domain capture input. Returns `null` when a
 * required selection is still missing, so Save stays disabled.
 */
export function draftToCapture(
  draft: SemanticDraft,
  weightKg: string,
  reps: number,
): SemanticCaptureInput | null {
  if (!draft.loadMode || !draft.side || !draft.setPurpose) {
    return null;
  }
  if (draft.loadMode !== 'bodyweight' && !draft.amountBasis) {
    return null;
  }
  if (draft.side === 'alternating' && !draft.repCountBasis) {
    return null;
  }
  return {
    semanticCaptureVersion: 1,
    loadMode: draft.loadMode,
    amountBasis: draft.amountBasis === '' ? null : draft.amountBasis,
    side: draft.side,
    setPurpose: draft.setPurpose,
    repCountBasis: draft.repCountBasis === '' ? null : draft.repCountBasis,
    weightKg,
    reps,
  };
}

/**
 * The visible save gate. Uses the shared domain validator, so the UI enables
 * Save exactly when the server would accept the tuple.
 */
export function evaluateCapture(
  draft: SemanticDraft,
  weightKg: string,
  reps: number,
): SemanticCaptureValidation | null {
  const input = draftToCapture(draft, weightKg, reps);
  return input ? validateSemanticCapture(input) : null;
}

/** Bodyweight records the canonical zero sentinel; other modes clear the amount. */
export function defaultWeightForLoadMode(loadMode: LoadMode | ''): string {
  return loadMode === 'bodyweight' ? '0' : '';
}

/** The visible, editable capture controls handed to the session UI. */
export interface SessionSemanticsControls {
  draft: SemanticDraft;
  reused: boolean;
  onLoadMode: (mode: LoadMode) => void;
  onAmountBasis: (basis: AmountBasis) => void;
  onSide: (side: Side) => void;
  onSetPurpose: (purpose: SetPurpose) => void;
  onRepCountBasis: (basis: RepCountBasis) => void;
}
