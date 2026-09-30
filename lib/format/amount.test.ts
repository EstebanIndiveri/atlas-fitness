import { describe, expect, it } from '@jest/globals';
import { describeRecordedAmount, formatCompactAmount, LEGACY_AMOUNT_LABEL } from './amount';
import type { CanonicalSemantics } from '@/types/progression';

function canonical(overrides: Partial<CanonicalSemantics> = {}): CanonicalSemantics {
  return {
    loadMode: 'external',
    amountBasis: 'total',
    side: 'bilateral',
    setPurpose: 'working',
    repCountBasis: null,
    ...overrides,
  };
}

describe('describeRecordedAmount', () => {
  it('labels a plain external total set', () => {
    expect(describeRecordedAmount(canonical(), '80')).toBe('80 kg');
  });

  it('labels a per-side amount without multiplying', () => {
    expect(describeRecordedAmount(canonical({ amountBasis: 'per_side' }), '20')).toBe('20 kg por lado');
  });

  it('labels bodyweight without a false kg claim', () => {
    expect(describeRecordedAmount(canonical({ loadMode: 'bodyweight', amountBasis: null }), '0')).toBe(
      'peso corporal (sin carga externa)',
    );
  });

  it('labels assistance as assistance', () => {
    expect(describeRecordedAmount(canonical({ loadMode: 'assisted' }), '25')).toBe('asistencia 25 kg');
  });

  it('labels added load separately from body mass', () => {
    expect(describeRecordedAmount(canonical({ loadMode: 'bodyweight_added' }), '10')).toBe('+10 kg agregados');
  });

  it('appends the alternating rep basis', () => {
    expect(describeRecordedAmount(canonical({ side: 'alternating', repCountBasis: 'per_side' }), '40')).toBe(
      '40 kg (alternado, reps por lado)',
    );
  });

  it('marks per-side for assisted and added load', () => {
    expect(describeRecordedAmount(canonical({ loadMode: 'assisted', amountBasis: 'per_side' }), '10')).toBe(
      'asistencia 10 kg por lado',
    );
    expect(
      describeRecordedAmount(canonical({ loadMode: 'bodyweight_added', amountBasis: 'per_side' }), '10'),
    ).toBe('+10 kg agregados por lado');
  });
});

describe('formatCompactAmount', () => {
  it('uses short, mode-aware labels', () => {
    expect(formatCompactAmount(canonical(), '80')).toBe('80');
    expect(formatCompactAmount(canonical({ amountBasis: 'per_side' }), '20')).toBe('20/lado');
    expect(formatCompactAmount(canonical({ loadMode: 'bodyweight', amountBasis: null }), '0')).toBe('PC');
    expect(formatCompactAmount(canonical({ loadMode: 'assisted' }), '25')).toBe('asist. 25');
    expect(formatCompactAmount(canonical({ loadMode: 'assisted', amountBasis: 'per_side' }), '25')).toBe(
      'asist. 25/lado',
    );
  });
});

describe('LEGACY_AMOUNT_LABEL', () => {
  it('never claims lifted load', () => {
    expect(LEGACY_AMOUNT_LABEL).toBe('carga registrada (sin contexto)');
  });
});
