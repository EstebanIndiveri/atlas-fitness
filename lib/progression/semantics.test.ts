import { describe, expect, it } from '@jest/globals';
import { canonicalSemantics, classifyEligibility, cohortKey, CAPTURE_VERSION_MAPPINGS } from './semantics';
import type {
  CanonicalSemantics,
  ProgressionObservation,
  RawSemanticFields,
} from '@/types/progression';

type SemanticFields = Omit<RawSemanticFields, 'semanticCaptureVersion'>;

const semanticFields = (overrides: Partial<SemanticFields> = {}): SemanticFields => ({
  loadMode: 'external',
  amountBasis: 'total',
  side: 'bilateral',
  setPurpose: 'working',
  repCountBasis: null,
  ...overrides,
});

const observation = (overrides: Partial<ProgressionObservation> = {}): ProgressionObservation => ({
  setId: 1,
  workoutId: 10,
  exerciseId: 100,
  setIndex: 0,
  reps: 5,
  weightKg: '100',
  completed: true,
  setDeleted: false,
  workoutEndedAt: new Date('2026-09-30T12:00:00.000Z'),
  workoutDeleted: false,
  exerciseAvailable: true,
  semantics: { semanticCaptureVersion: 1, ...semanticFields() },
  ...overrides,
});

describe('canonicalSemantics', () => {
  it('maps capture version 1 working external tuple', () => {
    expect(canonicalSemantics(1, semanticFields())).toEqual({
      status: 'canonical',
      tuple: {
        loadMode: 'external',
        amountBasis: 'total',
        side: 'bilateral',
        setPurpose: 'working',
        repCountBasis: null,
      },
    });
  });

  it('returns unknown_semantics when the capture version is null', () => {
    expect(canonicalSemantics(null, semanticFields())).toEqual({
      status: 'unknown',
      reason: 'unknown_semantics',
    });
  });

  it('returns unsupported_capture_version for unregistered versions', () => {
    for (const version of [2, 0, -1, 99]) {
      expect(canonicalSemantics(version, semanticFields())).toEqual({
        status: 'unknown',
        reason: 'unsupported_capture_version',
      });
    }
  });

  it('treats a legacy all-null tuple as unknown_semantics', () => {
    const legacy = semanticFields({
      loadMode: null,
      amountBasis: null,
      side: null,
      setPurpose: null,
      repCountBasis: null,
    });
    expect(canonicalSemantics(1, legacy)).toEqual({
      status: 'unknown',
      reason: 'unknown_semantics',
    });
  });

  it('treats each missing required axis as unknown_semantics', () => {
    for (const fields of [
      semanticFields({ loadMode: null }),
      semanticFields({ side: null }),
      semanticFields({ setPurpose: null }),
    ]) {
      expect(canonicalSemantics(1, fields)).toEqual({
        status: 'unknown',
        reason: 'unknown_semantics',
      });
    }
  });

  it('rejects invalid enum membership as invalid_semantic_combination', () => {
    for (const fields of [
      semanticFields({ loadMode: 'machine' }),
      semanticFields({ side: 'both' }),
      semanticFields({ setPurpose: 'top' }),
      semanticFields({ amountBasis: 'each_side' }),
      semanticFields({ side: 'alternating', repCountBasis: 'each' }),
    ]) {
      expect(canonicalSemantics(1, fields)).toEqual({
        status: 'unknown',
        reason: 'invalid_semantic_combination',
      });
    }
  });

  it('rejects corrupt / invalid axis combinations', () => {
    const invalid: SemanticFields[] = [
      semanticFields({ amountBasis: null }),
      semanticFields({ amountBasis: 'per_side', side: 'left' }),
      semanticFields({ amountBasis: 'per_side', side: 'right' }),
      semanticFields({ loadMode: 'bodyweight', amountBasis: 'total' }),
      semanticFields({ loadMode: 'bodyweight_added', amountBasis: 'per_side', side: 'left' }),
      semanticFields({ loadMode: 'assisted', amountBasis: 'per_side', side: 'right' }),
      semanticFields({ side: 'alternating' }),
      semanticFields({ repCountBasis: 'total' }),
      semanticFields({ side: 'left', repCountBasis: 'total' }),
    ];
    for (const fields of invalid) {
      expect(canonicalSemantics(1, fields)).toEqual({
        status: 'unknown',
        reason: 'invalid_semantic_combination',
      });
    }
  });

  it('canonicalizes valid recorded-but-not-comparable combinations', () => {
    const cases: Array<{ fields: SemanticFields; tuple: CanonicalSemantics }> = [
      {
        fields: semanticFields({ side: 'alternating', repCountBasis: 'per_side' }),
        tuple: {
          loadMode: 'external',
          amountBasis: 'total',
          side: 'alternating',
          setPurpose: 'working',
          repCountBasis: 'per_side',
        },
      },
      {
        fields: semanticFields({ loadMode: 'bodyweight', amountBasis: null, side: 'left' }),
        tuple: {
          loadMode: 'bodyweight',
          amountBasis: null,
          side: 'left',
          setPurpose: 'working',
          repCountBasis: null,
        },
      },
      {
        fields: semanticFields({
          loadMode: 'bodyweight',
          amountBasis: null,
          side: 'alternating',
          repCountBasis: 'total',
        }),
        tuple: {
          loadMode: 'bodyweight',
          amountBasis: null,
          side: 'alternating',
          setPurpose: 'working',
          repCountBasis: 'total',
        },
      },
      {
        fields: semanticFields({ loadMode: 'assisted', amountBasis: 'total', side: 'right' }),
        tuple: {
          loadMode: 'assisted',
          amountBasis: 'total',
          side: 'right',
          setPurpose: 'working',
          repCountBasis: null,
        },
      },
    ];
    for (const testCase of cases) {
      expect(canonicalSemantics(1, testCase.fields)).toEqual({
        status: 'canonical',
        tuple: testCase.tuple,
      });
    }
  });

  it('derives comparability from the canonical tuple, never from the capture version', () => {
    const result = canonicalSemantics(1, semanticFields());
    expect(result.status).toBe('canonical');
    if (result.status === 'canonical') {
      expect(result.tuple).not.toHaveProperty('semanticCaptureVersion');
      expect(Object.keys(result.tuple)).toEqual([
        'loadMode',
        'amountBasis',
        'side',
        'setPurpose',
        'repCountBasis',
      ]);
    }
    // Version 2 has no registered mapping under progression rule 1, so it is not
    // comparable even if a caller claims the same axes.
    expect(canonicalSemantics(2, semanticFields())).toEqual({
      status: 'unknown',
      reason: 'unsupported_capture_version',
    });
  });

  it('uses the version mapping registry as the single compatibility boundary', () => {
    expect(Object.keys(CAPTURE_VERSION_MAPPINGS)).toEqual(['1']);
    expect(Object.isFrozen(CAPTURE_VERSION_MAPPINGS)).toBe(true);
    expect(canonicalSemantics(1, semanticFields()).status).toBe('canonical');
  });
});

describe('classifyEligibility', () => {
  it('returns ELIGIBLE for a complete, compatible working external set', () => {
    expect(classifyEligibility(observation())).toEqual({
      status: 'ELIGIBLE',
      reason: 'eligible',
    });
  });

  it('returns ELIGIBLE for supported unilateral and per-side cohorts', () => {
    for (const overrides of [
      { semantics: { semanticCaptureVersion: 1, ...semanticFields({ side: 'left' }) } },
      { semantics: { semanticCaptureVersion: 1, ...semanticFields({ side: 'right' }) } },
      {
        semantics: {
          semanticCaptureVersion: 1,
          ...semanticFields({ amountBasis: 'per_side' as const }),
        },
      },
    ]) {
      expect(classifyEligibility(observation(overrides)).status).toBe('ELIGIBLE');
    }
  });

  it('applies lifecycle reasons in priority order', () => {
    expect(
      classifyEligibility(
        observation({ workoutDeleted: true, workoutEndedAt: null, setDeleted: true }),
      ),
    ).toEqual({ status: 'INELIGIBLE', reason: 'deleted_workout' });
    expect(classifyEligibility(observation({ workoutEndedAt: null }))).toEqual({
      status: 'INELIGIBLE',
      reason: 'open_workout',
    });
    expect(classifyEligibility(observation({ setDeleted: true }))).toEqual({
      status: 'INELIGIBLE',
      reason: 'deleted_set',
    });
    expect(classifyEligibility(observation({ completed: false }))).toEqual({
      status: 'INELIGIBLE',
      reason: 'incomplete_set',
    });
    expect(classifyEligibility(observation({ exerciseAvailable: false }))).toEqual({
      status: 'INELIGIBLE',
      reason: 'exercise_unavailable',
    });
  });

  it('returns UNKNOWN reasons from canonicalization', () => {
    const legacy = {
      semanticCaptureVersion: null,
      loadMode: null,
      amountBasis: null,
      side: null,
      setPurpose: null,
      repCountBasis: null,
    };
    expect(classifyEligibility(observation({ semantics: legacy }))).toEqual({
      status: 'UNKNOWN',
      reason: 'unknown_semantics',
    });
    expect(
      classifyEligibility(
        observation({ semantics: { semanticCaptureVersion: 2, ...semanticFields() } }),
      ),
    ).toEqual({ status: 'UNKNOWN', reason: 'unsupported_capture_version' });
    expect(
      classifyEligibility(
        observation({
          semantics: {
            semanticCaptureVersion: 1,
            ...semanticFields({ amountBasis: 'per_side', side: 'left' }),
          },
        }),
      ),
    ).toEqual({ status: 'UNKNOWN', reason: 'invalid_semantic_combination' });
  });

  it('rejects mode-inappropriate amounts with invalid_amount', () => {
    expect(
      classifyEligibility(
        observation({
          weightKg: '5',
          semantics: { semanticCaptureVersion: 1, ...semanticFields({ loadMode: 'bodyweight', amountBasis: null }) },
        }),
      ),
    ).toEqual({ status: 'INELIGIBLE', reason: 'invalid_amount' });
    expect(classifyEligibility(observation({ weightKg: '0' }))).toEqual({
      status: 'INELIGIBLE',
      reason: 'invalid_amount',
    });
    expect(classifyEligibility(observation({ reps: 0 }))).toEqual({
      status: 'INELIGIBLE',
      reason: 'invalid_amount',
    });
  });

  it('returns unsupported_load_mode for valid non-external working sets', () => {
    for (const overrides of [
      {
        weightKg: '0',
        semantics: { semanticCaptureVersion: 1, ...semanticFields({ loadMode: 'bodyweight', amountBasis: null }) },
      },
      {
        weightKg: '10',
        semantics: {
          semanticCaptureVersion: 1,
          ...semanticFields({ loadMode: 'bodyweight_added', amountBasis: 'total' }),
        },
      },
      {
        weightKg: '20',
        semantics: {
          semanticCaptureVersion: 1,
          ...semanticFields({ loadMode: 'assisted', amountBasis: 'total' }),
        },
      },
    ]) {
      expect(classifyEligibility(observation(overrides))).toEqual({
        status: 'INELIGIBLE',
        reason: 'unsupported_load_mode',
      });
    }
  });

  it('returns warmup before unsupported mode or side', () => {
    expect(
      classifyEligibility(
        observation({
          weightKg: '0',
          semantics: {
            semanticCaptureVersion: 1,
            ...semanticFields({ loadMode: 'bodyweight', amountBasis: null, setPurpose: 'warmup' }),
          },
        }),
      ),
    ).toEqual({ status: 'INELIGIBLE', reason: 'warmup' });
    expect(
      classifyEligibility(
        observation({
          semantics: {
            semanticCaptureVersion: 1,
            ...semanticFields({ side: 'alternating', repCountBasis: 'total', setPurpose: 'warmup' }),
          },
        }),
      ),
    ).toEqual({ status: 'INELIGIBLE', reason: 'warmup' });
  });

  it('returns unsupported_side for alternating external sets', () => {
    expect(
      classifyEligibility(
        observation({
          semantics: {
            semanticCaptureVersion: 1,
            ...semanticFields({ side: 'alternating', repCountBasis: 'total' }),
          },
        }),
      ),
    ).toEqual({ status: 'INELIGIBLE', reason: 'unsupported_side' });
  });
});

describe('cohortKey', () => {
  it('derives the external cohort from the canonical tuple', () => {
    expect(
      cohortKey({
        exerciseId: 42,
        reps: 5,
        canonical: {
          loadMode: 'external',
          amountBasis: 'total',
          side: 'left',
          setPurpose: 'working',
          repCountBasis: null,
        },
      }),
    ).toEqual({ exerciseId: 42, loadMode: 'external', amountBasis: 'total', side: 'left', reps: 5 });
  });

  it('keeps bilateral total and per_side as distinct cohorts', () => {
    const total = cohortKey({
      exerciseId: 1,
      reps: 5,
      canonical: {
        loadMode: 'external',
        amountBasis: 'total',
        side: 'bilateral',
        setPurpose: 'working',
        repCountBasis: null,
      },
    });
    const perSide = cohortKey({
      exerciseId: 1,
      reps: 5,
      canonical: {
        loadMode: 'external',
        amountBasis: 'per_side',
        side: 'bilateral',
        setPurpose: 'working',
        repCountBasis: null,
      },
    });
    expect(total).not.toEqual(perSide);
    expect(total?.amountBasis).toBe('total');
    expect(perSide?.amountBasis).toBe('per_side');
  });

  it('returns null for non-external, missing-basis or alternating tuples', () => {
    const base = {
      loadMode: 'external',
      amountBasis: 'total',
      side: 'bilateral',
      setPurpose: 'working',
      repCountBasis: null,
    } as const;
    expect(
      cohortKey({
        exerciseId: 1,
        reps: 5,
        canonical: { ...base, loadMode: 'bodyweight', amountBasis: null },
      }),
    ).toBeNull();
    expect(
      cohortKey({
        exerciseId: 1,
        reps: 5,
        canonical: { ...base, side: 'alternating', repCountBasis: 'total' },
      }),
    ).toBeNull();
    expect(cohortKey({ exerciseId: 1, reps: 5, canonical: { ...base, amountBasis: null } })).toBeNull();
  });
});
