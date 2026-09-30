import { describe, expect, it } from '@jest/globals';

import { resolveProgressionSupport } from './progression-cohort';

function input(overrides: Partial<Parameters<typeof resolveProgressionSupport>[0]> = {}) {
  return {
    loadMode: 'external',
    amountBasis: 'total',
    side: 'bilateral',
    setPurpose: 'working',
    reps: 8,
    ...overrides,
  };
}

describe('resolveProgressionSupport', () => {
  it('supports the exact external working cohort with a chosen basis, side and reps', () => {
    expect(resolveProgressionSupport(input())).toEqual({
      status: 'supported',
      cohort: { reps: 8, amountBasis: 'total', side: 'bilateral' },
    });
    expect(resolveProgressionSupport(input({ amountBasis: 'per_side', side: 'left' }))).toEqual({
      status: 'supported',
      cohort: { reps: 8, amountBasis: 'per_side', side: 'left' },
    });
  });

  it('never manufactures a cohort while the selection is incomplete', () => {
    expect(resolveProgressionSupport(input({ loadMode: '' })).status).toBe('unsupported');
    expect(resolveProgressionSupport(input({ side: '' }))).toEqual({
      status: 'unsupported',
      reason: 'missing_selection',
    });
    expect(resolveProgressionSupport(input({ setPurpose: '' }))).toEqual({
      status: 'unsupported',
      reason: 'missing_selection',
    });
    expect(resolveProgressionSupport(input({ amountBasis: '' }))).toEqual({
      status: 'unsupported',
      reason: 'missing_selection',
    });
  });

  it('treats bodyweight, added load and assistance as non-comparable', () => {
    expect(resolveProgressionSupport(input({ loadMode: 'bodyweight', amountBasis: '' }))).toEqual({
      status: 'unsupported',
      reason: 'unsupported_load_mode',
    });
    expect(resolveProgressionSupport(input({ loadMode: 'bodyweight_added' }))).toEqual({
      status: 'unsupported',
      reason: 'unsupported_load_mode',
    });
    expect(resolveProgressionSupport(input({ loadMode: 'assisted' }))).toEqual({
      status: 'unsupported',
      reason: 'unsupported_load_mode',
    });
  });

  it('excludes alternating sets from v0.12 comparison', () => {
    expect(resolveProgressionSupport(input({ side: 'alternating' }))).toEqual({
      status: 'unsupported',
      reason: 'alternating',
    });
  });

  it('excludes warmups regardless of load mode', () => {
    expect(resolveProgressionSupport(input({ setPurpose: 'warmup' }))).toEqual({
      status: 'unsupported',
      reason: 'warmup',
    });
  });

  it('requires a positive integer rep count', () => {
    expect(resolveProgressionSupport(input({ reps: 0 }))).toEqual({
      status: 'unsupported',
      reason: 'invalid_reps',
    });
    expect(resolveProgressionSupport(input({ reps: 8.5 }))).toEqual({
      status: 'unsupported',
      reason: 'invalid_reps',
    });
  });
});
