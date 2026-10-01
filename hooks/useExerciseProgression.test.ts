import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useExerciseProgression } from './useExerciseProgression';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

const READY = {
  metricId: 'same_reps_external_load',
  progressionRuleVersion: 1,
  readStatus: 'ready',
  cohort: { exerciseId: 3, loadMode: 'external', amountBasis: 'total', side: 'bilateral', reps: 8 },
  currentRepresentative: null,
  previousComparableRepresentative: null,
  currentBest: null,
  comparison: 'baseline',
  reasons: ['eligible'],
  history: { items: [], nextCursor: null, limit: 10, bounded: true },
  provenance: 'atlas_computed',
};

describe('useExerciseProgression', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads the read model for a supported cohort', async () => {
    const fetchMock = jest.fn(async (_input: Parameters<typeof fetch>[0]) => jsonResponse(READY));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useExerciseProgression({
        exerciseId: 3,
        cohort: { reps: 8, amountBasis: 'total', side: 'bilateral' },
      }),
    );

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/exercises/3/progression?');
  });

  it('never requests anything without a comparable cohort', () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useExerciseProgression({ exerciseId: 3, cohort: null }));

    expect(result.current.state.status).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a typed error state and can retry', async () => {
    const fetchMock = jest.fn(async () => jsonResponse({ code: 'SERVICE_UNAVAILABLE' }, 503));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useExerciseProgression({
        exerciseId: 3,
        cohort: { reps: 8, amountBasis: 'total', side: 'bilateral' },
      }),
    );

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => result.current.reload());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
