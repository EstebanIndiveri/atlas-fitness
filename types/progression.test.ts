import { describe, expect, it } from '@jest/globals';
import {
  AMOUNT_BASES,
  LOAD_MODES,
  PROGRESSION_RULE_VERSION,
  REP_COUNT_BASES,
  SAME_REPS_EXTERNAL_LOAD_METRIC,
  SEMANTIC_CAPTURE_VERSION_1,
  SET_PURPOSES,
  SIDES,
} from './progression';
import type {
  AmountBasis,
  CanonicalSemantics,
  CohortKey,
  EligibilityResult,
  LoadMode,
  ProgressionComparison,
  RepCountBasis,
  SetPurpose,
  Side,
} from './progression';

describe('progression vocabulary', () => {
  it('exposes the supported load modes', () => {
    expect(LOAD_MODES).toEqual(['external', 'bodyweight', 'bodyweight_added', 'assisted']);
  });

  it('exposes the supported amount bases', () => {
    expect(AMOUNT_BASES).toEqual(['total', 'per_side']);
  });

  it('exposes the supported sides', () => {
    expect(SIDES).toEqual(['bilateral', 'left', 'right', 'alternating']);
  });

  it('exposes the supported set purposes', () => {
    expect(SET_PURPOSES).toEqual(['working', 'warmup']);
  });

  it('exposes the supported rep-count bases', () => {
    expect(REP_COUNT_BASES).toEqual(['total', 'per_side']);
  });

  it('pins the version and metric identifiers', () => {
    expect(SEMANTIC_CAPTURE_VERSION_1).toBe(1);
    expect(PROGRESSION_RULE_VERSION).toBe(1);
    expect(SAME_REPS_EXTERNAL_LOAD_METRIC).toBe('same_reps_external_load');
  });

  it('keeps the canonical tuple free of capture-version data', () => {
    const tuple: CanonicalSemantics = {
      loadMode: 'external',
      amountBasis: 'total',
      side: 'bilateral',
      setPurpose: 'working',
      repCountBasis: null,
    };
    expect(Object.keys(tuple)).toEqual([
      'loadMode',
      'amountBasis',
      'side',
      'setPurpose',
      'repCountBasis',
    ]);
  });

  it('discriminates eligibility, cohort and comparison result shapes', () => {
    const eligible: EligibilityResult = { status: 'ELIGIBLE', reason: 'eligible' };
    const unknown: EligibilityResult = { status: 'UNKNOWN', reason: 'unknown_semantics' };
    const ineligible: EligibilityResult = { status: 'INELIGIBLE', reason: 'warmup' };
    const cohort: CohortKey = {
      exerciseId: 1,
      loadMode: 'external',
      amountBasis: 'total',
      side: 'left',
      reps: 5,
    };
    const comparison: ProgressionComparison = 'baseline';

    expect(eligible.status).toBe('ELIGIBLE');
    expect(unknown.status).toBe('UNKNOWN');
    expect(ineligible.status).toBe('INELIGIBLE');
    expect(cohort.side).toBe('left');
    expect(comparison).toBe('baseline');
  });

  it('keeps the vocabulary literal unions assignable', () => {
    const loadMode: LoadMode = 'assisted';
    const amountBasis: AmountBasis = 'per_side';
    const side: Side = 'alternating';
    const purpose: SetPurpose = 'warmup';
    const repCountBasis: RepCountBasis = 'total';

    expect([loadMode, amountBasis, side, purpose, repCountBasis]).toEqual([
      'assisted',
      'per_side',
      'alternating',
      'warmup',
      'total',
    ]);
  });
});
