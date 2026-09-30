/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  ExerciseProgressionClientError,
  fetchExerciseProgression,
  parseExerciseProgression,
} from './exercise-progression';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

const SEMANTICS = {
  semanticCaptureVersion: 1,
  loadMode: 'external',
  amountBasis: 'total',
  side: 'bilateral',
  setPurpose: 'working',
  repCountBasis: null,
};

const SOURCE_SET = {
  setId: 11,
  workoutId: 5,
  setIndex: 1,
  reps: 8,
  weightKg: '80',
  endedAt: '2026-09-20T12:00:00.000Z',
  localDate: '2026-09-20',
  semantics: SEMANTICS,
  provenance: 'user_input',
};

const READY = {
  metricId: 'same_reps_external_load',
  progressionRuleVersion: 1,
  readStatus: 'ready',
  cohort: { exerciseId: 3, loadMode: 'external', amountBasis: 'total', side: 'bilateral', reps: 8 },
  currentRepresentative: SOURCE_SET,
  previousComparableRepresentative: null,
  currentBest: SOURCE_SET,
  comparison: 'new_pr',
  reasons: ['eligible'],
  history: { items: [], nextCursor: null, limit: 10, bounded: true },
  provenance: 'atlas_computed',
};

describe('parseExerciseProgression', () => {
  it('parses a valid ready read model', () => {
    expect(parseExerciseProgression(READY)).toEqual(READY);
  });

  it('parses an empty no_history model with null selections', () => {
    const empty = {
      ...READY,
      readStatus: 'no_history',
      currentRepresentative: null,
      currentBest: null,
      comparison: null,
      reasons: [],
    };
    expect(parseExerciseProgression(empty)).toEqual(empty);
  });

  it('rejects bodies that would let the UI misread a claim', () => {
    expect(parseExerciseProgression(null)).toBeNull();
    expect(parseExerciseProgression({ ...READY, metricId: 'unknown_metric' })).toBeNull();
    expect(parseExerciseProgression({ ...READY, readStatus: 'maybe' })).toBeNull();
    expect(parseExerciseProgression({ ...READY, comparison: 'stronger' })).toBeNull();
    expect(parseExerciseProgression({ ...READY, provenance: 'user_input' })).toBeNull();
    expect(
      parseExerciseProgression({ ...READY, currentBest: { ...SOURCE_SET, weightKg: 80 } }),
    ).toBeNull();
    expect(
      parseExerciseProgression({ ...READY, history: { ...READY.history, bounded: false } }),
    ).toBeNull();
    expect(
      parseExerciseProgression({ ...READY, cohort: { ...READY.cohort, amountBasis: 'each' } }),
    ).toBeNull();
  });
});

describe('fetchExerciseProgression', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('requests the exact cohort and returns the parsed model', async () => {
    const fetchMock = jest.fn(async (_input: Parameters<typeof fetch>[0]) => jsonResponse(READY));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchExerciseProgression(
      3,
      { reps: 8, amountBasis: 'total', side: 'bilateral' },
      { limit: 5 },
    );

    expect(result).toEqual(READY);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      '/api/exercises/3/progression?reps=8&amountBasis=total&side=bilateral&limit=5',
    );
  });

  it('maps HTTP statuses to typed errors', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'NOT_FOUND', message: 'Ejercicio no encontrado' }, 404),
    ) as unknown as typeof fetch;

    await expect(
      fetchExerciseProgression(3, { reps: 8, amountBasis: 'total', side: 'bilateral' }),
    ).rejects.toMatchObject({ name: 'ExerciseProgressionClientError', kind: 'not_found', status: 404 });
  });

  it('throws a generic error for a malformed success body', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ metricId: 'oops' })) as unknown as typeof fetch;

    const error = await fetchExerciseProgression(3, {
      reps: 8,
      amountBasis: 'total',
      side: 'bilateral',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ExerciseProgressionClientError);
    expect((error as ExerciseProgressionClientError).kind).toBe('generic');
  });
});
