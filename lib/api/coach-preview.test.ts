/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { CoachPreviewClientError, previewCoachAdaptation } from './coach-preview';
import type { CoachAdaptationResult } from '@/types/coach';

const validBody: CoachAdaptationResult = {
  original: { exerciseCount: 2, setCount: 7, estMinutes: 21 },
  adapted: { exerciseCount: 2, setCount: 6, estMinutes: 18 },
  exerciseDeltas: [
    { exerciseId: 101, name: 'Sentadilla', action: 'kept', fromSets: 4, toSets: 4 },
    { exerciseId: 102, name: 'Curl', action: 'reduced', fromSets: 3, toSets: 2 },
  ],
  reason: 'Bajamos volumen porque registraste energía baja.',
  source: 'deterministic',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('coach preview client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts the request and parses a valid adaptation body', async () => {
    global.fetch = jest.fn(async () => jsonResponse(validBody)) as unknown as typeof fetch;

    await expect(
      previewCoachAdaptation({ routineId: 10, energy: 'low', mood: 2, freeText: 'Estoy cansado' }),
    ).resolves.toEqual(validBody);
    expect(global.fetch).toHaveBeenCalledWith('/api/coach/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routineId: 10, energy: 'low', mood: 2, freeText: 'Estoy cansado' }),
    });
  });

  it.each([
    [401, 'UNAUTHORIZED', 'unauthorized'],
    [400, 'VALIDATION', 'validation'],
    [404, 'NOT_FOUND', 'not_found'],
  ] as const)('maps %i %s to %s', async (status, code, kind) => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code, message: 'Error controlado' }, status),
    ) as unknown as typeof fetch;

    await expect(previewCoachAdaptation({ routineId: 10 })).rejects.toMatchObject({
      name: 'CoachPreviewClientError',
      kind,
      status,
      api: { code, message: 'Error controlado' },
    });
  });

  it('throws a generic typed error on malformed success body', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ original: null })) as unknown as typeof fetch;

    const promise = previewCoachAdaptation({ routineId: 10 });

    await expect(promise).rejects.toBeInstanceOf(CoachPreviewClientError);
    await expect(promise).rejects.toMatchObject({
      kind: 'generic',
      status: 200,
    });
  });
});
