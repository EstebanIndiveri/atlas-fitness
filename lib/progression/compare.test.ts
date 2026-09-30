import { describe, expect, it } from '@jest/globals';
import { compareToPriorBest, selectWorkoutRepresentative } from './compare';
import type {
  CanonicalSemantics,
  CohortKey,
  EligibleSet,
  ProgressionObservation,
} from '@/types/progression';

const canonical = (overrides: Partial<CanonicalSemantics> = {}): CanonicalSemantics => ({
  loadMode: 'external',
  amountBasis: 'total',
  side: 'bilateral',
  setPurpose: 'working',
  repCountBasis: null,
  ...overrides,
});

const cohort = (overrides: Partial<CohortKey> = {}): CohortKey => ({
  exerciseId: 100,
  loadMode: 'external',
  amountBasis: 'total',
  side: 'bilateral',
  reps: 5,
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
  semantics: {
    semanticCaptureVersion: 1,
    loadMode: 'external',
    amountBasis: 'total',
    side: 'bilateral',
    setPurpose: 'working',
    repCountBasis: null,
  },
  ...overrides,
});

interface SetOverrides {
  observation?: Partial<ProgressionObservation>;
  canonical?: Partial<CanonicalSemantics>;
  cohort?: Partial<CohortKey>;
}

const eligibleSet = (overrides: SetOverrides = {}): EligibleSet => ({
  observation: observation(overrides.observation),
  canonical: canonical(overrides.canonical),
  cohort: cohort(overrides.cohort),
});

describe('selectWorkoutRepresentative', () => {
  it('returns null for an empty workout', () => {
    expect(selectWorkoutRepresentative([])).toBeNull();
  });

  it('returns the only eligible set', () => {
    const representative = selectWorkoutRepresentative([eligibleSet()]);
    expect(representative).toMatchObject({
      workoutId: 10,
      setId: 1,
      setIndex: 0,
      reps: 5,
      weightKg: '100',
    });
    expect(representative?.endedAt).toEqual(new Date('2026-09-30T12:00:00.000Z'));
  });

  it('selects the highest exact decimal amount within a workout', () => {
    const representative = selectWorkoutRepresentative([
      eligibleSet({ observation: { setId: 1, setIndex: 0, weightKg: '99.99' } }),
      eligibleSet({ observation: { setId: 2, setIndex: 1, weightKg: '100' } }),
      eligibleSet({ observation: { setId: 3, setIndex: 2, weightKg: '99.999' } }),
    ]);
    expect(representative?.setId).toBe(2);
    expect(representative?.weightKg).toBe('100');
  });

  it('compares amounts by value, not lexicographically', () => {
    const representative = selectWorkoutRepresentative([
      eligibleSet({ observation: { setId: 1, setIndex: 0, weightKg: '1.1' } }),
      eligibleSet({ observation: { setId: 2, setIndex: 1, weightKg: '1.01' } }),
    ]);
    expect(representative?.setId).toBe(1);
  });

  it('breaks ties with the lowest (setIndex, setId)', () => {
    const representative = selectWorkoutRepresentative([
      eligibleSet({ observation: { setId: 7, setIndex: 1, weightKg: '100' } }),
      eligibleSet({ observation: { setId: 3, setIndex: 2, weightKg: '100.0' } }),
      eligibleSet({ observation: { setId: 9, setIndex: 1, weightKg: '100.00' } }),
    ]);
    expect(representative?.setId).toBe(7);
    expect(representative?.setIndex).toBe(1);
  });

  it('returns the selected cohort, never a merged one', () => {
    const representative = selectWorkoutRepresentative([
      eligibleSet({
        observation: { setId: 5, setIndex: 0, weightKg: '40' },
        cohort: { amountBasis: 'per_side', reps: 5 },
      }),
    ]);
    expect(representative?.cohort).toEqual({
      exerciseId: 100,
      loadMode: 'external',
      amountBasis: 'per_side',
      side: 'bilateral',
      reps: 5,
    });
  });

  it('ignores sets without a closed-workout timestamp defensively', () => {
    expect(
      selectWorkoutRepresentative([
        eligibleSet({ observation: { setId: 1, workoutEndedAt: null, weightKg: '500' } }),
        eligibleSet({ observation: { setId: 2, weightKg: '100' } }),
      ])?.setId,
    ).toBe(2);
    expect(
      selectWorkoutRepresentative([
        eligibleSet({ observation: { setId: 1, workoutEndedAt: null, weightKg: '500' } }),
      ]),
    ).toBeNull();
  });
});

describe('compareToPriorBest', () => {
  it('never calls the first observation a PR', () => {
    expect(compareToPriorBest('100', null)).toBe('baseline');
  });

  it('classifies a strictly greater amount as new_pr', () => {
    expect(compareToPriorBest('100', '99.99')).toBe('new_pr');
    expect(compareToPriorBest('1.1', '1.01')).toBe('new_pr');
  });

  it('classifies an equal amount as ties_best regardless of precision', () => {
    expect(compareToPriorBest('100', '100')).toBe('ties_best');
    expect(compareToPriorBest('100', '100.00')).toBe('ties_best');
    expect(compareToPriorBest('1.10', '1.1')).toBe('ties_best');
  });

  it('classifies a lower amount as below_best', () => {
    expect(compareToPriorBest('99.99', '100')).toBe('below_best');
    expect(compareToPriorBest('1.01', '1.1')).toBe('below_best');
  });
});
