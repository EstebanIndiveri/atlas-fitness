import { describe, expect, it, jest } from '@jest/globals';

import {
  buildProgressionEventKey,
  deriveEligibleCohorts,
  findVerifiedClosePr,
  verifyProgressionResult,
} from './close-pr';
import type { CloseCandidateSet, ProgressionCandidate } from './close-pr';
import type { ExerciseProgression, ProgressionSourceSet } from '@/types/progression-read';
import type { ProgressionQueryCohort } from '@/lib/api/exercise-progression';

type FetchProgressionFn = (
  exerciseId: number,
  cohort: ProgressionQueryCohort,
) => Promise<ExerciseProgression>;

const SEMANTICS = {
  semanticCaptureVersion: 1,
  loadMode: 'external' as const,
  amountBasis: 'total' as const,
  side: 'bilateral' as const,
  setPurpose: 'working' as const,
  repCountBasis: null,
};

function candidateSet(overrides: Partial<CloseCandidateSet> = {}): CloseCandidateSet {
  return {
    id: 1,
    exerciseId: 3,
    setIndex: 1,
    reps: 8,
    completed: true,
    deletedAt: null,
    semanticCaptureVersion: 1,
    loadMode: 'external',
    amountBasis: 'total',
    side: 'bilateral',
    setPurpose: 'working',
    repCountBasis: null,
    ...overrides,
  };
}

function sourceSet(overrides: Partial<ProgressionSourceSet> = {}): ProgressionSourceSet {
  return {
    setId: 11,
    workoutId: 5,
    setIndex: 1,
    reps: 8,
    weightKg: '80',
    endedAt: '2026-09-20T12:00:00.000Z',
    localDate: '2026-09-20',
    semantics: SEMANTICS,
    provenance: 'user_input',
    ...overrides,
  };
}

function progression(overrides: Partial<ExerciseProgression> = {}): ExerciseProgression {
  return {
    metricId: 'same_reps_external_load',
    progressionRuleVersion: 1,
    readStatus: 'ready',
    cohort: {
      exerciseId: 3,
      loadMode: 'external',
      amountBasis: 'total',
      side: 'bilateral',
      reps: 8,
    },
    currentRepresentative: sourceSet(),
    previousComparableRepresentative: sourceSet({ setId: 4, workoutId: 6, weightKg: '75' }),
    currentBest: sourceSet({ setId: 11, weightKg: '80' }),
    comparison: 'new_pr',
    reasons: ['eligible'],
    history: { items: [], nextCursor: null, limit: 10, bounded: true },
    provenance: 'atlas_computed',
    ...overrides,
  };
}

describe('deriveEligibleCohorts', () => {
  it('derives one external working cohort from an eligible set', () => {
    expect(deriveEligibleCohorts([candidateSet()])).toEqual([
      { exerciseId: 3, cohort: { reps: 8, amountBasis: 'total', side: 'bilateral' } },
    ]);
  });

  it('deduplicates identical cohorts, keeping deterministic set ordering', () => {
    const candidates = deriveEligibleCohorts([
      candidateSet({ id: 2, setIndex: 2 }),
      candidateSet({ id: 1, setIndex: 1 }),
      candidateSet({ id: 3, setIndex: 3, reps: 5 }),
    ]);

    expect(candidates).toEqual([
      { exerciseId: 3, cohort: { reps: 8, amountBasis: 'total', side: 'bilateral' } },
      { exerciseId: 3, cohort: { reps: 5, amountBasis: 'total', side: 'bilateral' } },
    ]);
  });

  it.each([
    ['bodyweight', { loadMode: 'bodyweight', amountBasis: null }],
    ['added', { loadMode: 'bodyweight_added' }],
    ['assisted', { loadMode: 'assisted' }],
    ['warmup', { setPurpose: 'warmup' }],
    ['alternating', { side: 'alternating', repCountBasis: 'total' }],
    ['legacy', { semanticCaptureVersion: null, loadMode: null, amountBasis: null, side: null, setPurpose: null }],
    ['deleted', { deletedAt: new Date() }],
    ['incomplete', { completed: false }],
    ['invalid reps', { reps: 0 }],
  ] as const)('never queries %s semantics', (_label, overrides) => {
    expect(deriveEligibleCohorts([candidateSet(overrides as Partial<CloseCandidateSet>)])).toEqual([]);
  });
});

describe('verifyProgressionResult', () => {
  const baseInput = {
    exerciseId: 3,
    cohort: { reps: 8, amountBasis: 'total' as const, side: 'bilateral' as const },
    workoutId: 5,
    closedSetIds: new Set([11, 12]),
  };

  it('accepts a fully matching verified new PR', () => {
    const event = verifyProgressionResult(progression(), baseInput);
    expect(event).not.toBeNull();
    expect(event?.sourceSet.setId).toBe(11);
    expect(event?.key).toBe('1:same_reps_external_load:3:8:total:bilateral:11');
  });

  it.each(['baseline', 'ties_best', 'below_best'] as const)(
    'rejects %s even when the read model is ready',
    (comparison) => {
      expect(verifyProgressionResult(progression({ comparison }), baseInput)).toBeNull();
    },
  );

  it.each(['no_history', 'history_without_semantics', 'no_comparable_set'] as const)(
    'rejects readStatus %s',
    (readStatus) => {
      expect(verifyProgressionResult(progression({ readStatus, comparison: null }), baseInput)).toBeNull();
    },
  );

  it('rejects a result belonging to a different workout', () => {
    expect(
      verifyProgressionResult(
        progression({ currentRepresentative: sourceSet({ setId: 11, workoutId: 99 }) }),
        baseInput,
      ),
    ).toBeNull();
  });

  it('rejects a source set that is not part of the just-closed workout', () => {
    expect(
      verifyProgressionResult(
        progression({ currentRepresentative: sourceSet({ setId: 999 }) }),
        baseInput,
      ),
    ).toBeNull();
  });

  it('rejects a missing previous comparable or representative', () => {
    expect(
      verifyProgressionResult(progression({ previousComparableRepresentative: null }), baseInput),
    ).toBeNull();
    expect(
      verifyProgressionResult(progression({ currentRepresentative: null }), baseInput),
    ).toBeNull();
  });

  it('rejects an unknown metric or unsupported rule version', () => {
    expect(
      verifyProgressionResult(
        progression({ metricId: 'unknown' as ExerciseProgression['metricId'] }),
        baseInput,
      ),
    ).toBeNull();
    expect(
      verifyProgressionResult(progression({ progressionRuleVersion: 99 }), baseInput),
    ).toBeNull();
  });

  it('rejects a result whose cohort does not match the candidate query', () => {
    expect(
      verifyProgressionResult(progression({ cohort: { ...progression().cohort, reps: 5 } }), baseInput),
    ).toBeNull();
    expect(
      verifyProgressionResult(
        progression({ cohort: { ...progression().cohort, side: 'left' } }),
        baseInput,
      ),
    ).toBeNull();
    expect(
      verifyProgressionResult(
        progression({ cohort: { ...progression().cohort, exerciseId: 7 } }),
        baseInput,
      ),
    ).toBeNull();
  });
});

describe('findVerifiedClosePr', () => {
  const candidates: ProgressionCandidate[] = [
    { exerciseId: 3, cohort: { reps: 8, amountBasis: 'total', side: 'bilateral' } },
  ];
  const baseInput = {
    workoutId: 5,
    closedSetIds: new Set([11]),
    candidates,
    timeoutMs: 50,
  };

  it('returns the verified event from the read model', async () => {
    const fetchProgression = jest.fn<FetchProgressionFn>(async () => progression());
    const event = await findVerifiedClosePr({ ...baseInput, fetchProgression });
    expect(event?.sourceSet.setId).toBe(11);
    expect(fetchProgression).toHaveBeenCalledWith(3, candidates[0].cohort);
  });

  it('omits the celebration on a network error', async () => {
    const fetchProgression = jest.fn<FetchProgressionFn>(async () => {
      throw new Error('network');
    });
    await expect(findVerifiedClosePr({ ...baseInput, fetchProgression })).resolves.toBeNull();
  });

  it('omits the celebration when the query times out', async () => {
    const fetchProgression = jest.fn<FetchProgressionFn>(
      () => new Promise<ExerciseProgression>(() => {}),
    );
    await expect(
      findVerifiedClosePr({ ...baseInput, fetchProgression, timeoutMs: 5 }),
    ).resolves.toBeNull();
  });

  it('keeps looking after a non-PR candidate and returns only the first verified PR', async () => {
    const twoCandidates: ProgressionCandidate[] = [
      { exerciseId: 3, cohort: { reps: 8, amountBasis: 'total', side: 'bilateral' } },
      { exerciseId: 4, cohort: { reps: 5, amountBasis: 'total', side: 'bilateral' } },
    ];
    const fetchProgression = jest.fn<FetchProgressionFn>(async (exerciseId) => {
      if (exerciseId === 3) {
        return progression({ comparison: 'baseline' });
      }
      return progression({
        cohort: { exerciseId: 4, loadMode: 'external', amountBasis: 'total', side: 'bilateral', reps: 5 },
        currentRepresentative: sourceSet({ setId: 21, workoutId: 5 }),
      });
    });

    const event = await findVerifiedClosePr({
      workoutId: 5,
      closedSetIds: new Set([11, 21]),
      candidates: twoCandidates,
      fetchProgression,
      timeoutMs: 50,
    });

    expect(event?.exerciseId).toBe(4);
    expect(event?.sourceSet.setId).toBe(21);
  });

  it('returns null for an empty candidate list', async () => {
    await expect(
      findVerifiedClosePr({ ...baseInput, candidates: [], fetchProgression: jest.fn<FetchProgressionFn>() }),
    ).resolves.toBeNull();
  });
});

describe('buildProgressionEventKey', () => {
  it('includes rule version, metric, exact cohort and source set', () => {
    expect(buildProgressionEventKey(progression())).toBe(
      '1:same_reps_external_load:3:8:total:bilateral:11',
    );
  });
});
