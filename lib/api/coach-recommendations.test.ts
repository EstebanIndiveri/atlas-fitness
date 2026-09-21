/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  CoachRecommendationsClientError,
  decideCoachRecommendation,
  recordCoachRecommendation,
} from './coach-recommendations';
import type { CoachRecommendationDto } from '@/lib/services/coach-recommendation';

const dto: CoachRecommendationDto = {
  id: 101,
  userId: 7,
  workoutId: 42,
  dailyCheckInId: null,
  contextSnapshot: null,
  source: 'deterministic',
  result: {
    original: { exerciseCount: 2, setCount: 8, estMinutes: 30 },
    adapted: { exerciseCount: 2, setCount: 6, estMinutes: 24 },
    exerciseDeltas: [
      { exerciseId: 10, name: 'Sentadilla', action: 'reduced', fromSets: 4, toSets: 3 },
    ],
    reason: 'Bajamos volumen porque registraste energía baja.',
    source: 'deterministic',
  },
  decision: 'pending',
  decidedAt: null,
  createdAt: '2026-09-20T21:00:00.000Z',
  updatedAt: '2026-09-20T21:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('coach recommendations client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts a recommendation record request and parses the DTO', async () => {
    global.fetch = jest.fn(async () => jsonResponse(dto, 201)) as unknown as typeof fetch;

    await expect(recordCoachRecommendation({
      workoutId: 42,
      source: 'deterministic',
      result: dto.result,
    })).resolves.toEqual(dto);

    expect(global.fetch).toHaveBeenCalledWith('/api/coach/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workoutId: 42, source: 'deterministic', result: dto.result }),
    });
  });

  it('posts a decision request and parses the decided DTO', async () => {
    const decided = { ...dto, decision: 'accepted', decidedAt: '2026-09-20T21:03:00.000Z' };
    global.fetch = jest.fn(async () => jsonResponse(decided)) as unknown as typeof fetch;

    await expect(decideCoachRecommendation({ id: 101, decision: 'accepted' })).resolves.toEqual(decided);

    expect(global.fetch).toHaveBeenCalledWith('/api/coach/recommendations/101/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'accepted' }),
    });
  });

  it.each([
    [401, 'UNAUTHORIZED', 'unauthorized'],
    [400, 'VALIDATION', 'validation'],
    [404, 'NOT_FOUND', 'not_found'],
    [409, 'CONFLICT', 'conflict'],
  ] as const)('maps %i %s to %s', async (status, code, kind) => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code, message: 'Error controlado' }, status),
    ) as unknown as typeof fetch;

    await expect(decideCoachRecommendation({ id: 101, decision: 'rejected' })).rejects.toMatchObject({
      name: 'CoachRecommendationsClientError',
      kind,
      status,
      api: { code, message: 'Error controlado' },
    });
  });

  it('throws a generic typed error on malformed success body', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ id: 101 })) as unknown as typeof fetch;

    const promise = recordCoachRecommendation({ workoutId: 42, source: 'deterministic', result: dto.result });

    await expect(promise).rejects.toBeInstanceOf(CoachRecommendationsClientError);
    await expect(promise).rejects.toMatchObject({ kind: 'generic', status: 200 });
  });
});
