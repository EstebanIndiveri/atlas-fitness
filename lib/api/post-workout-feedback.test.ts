/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { fetchPostWorkoutFeedback, recordPostWorkoutFeedback } from './post-workout-feedback';
import type { RecordPostWorkoutFeedbackInput } from './post-workout-feedback';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function textResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as Response;
}

describe('post-workout feedback client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('records feedback through the typed client without changing fields', async () => {
    const payload = {
      id: 1,
      workoutId: 22,
      localDate: '2026-09-16',
      effort: { value: 8, source: 'user_input' },
      sensation: { value: 'hard', source: 'user_input' },
      discomfort: { value: [{ area: 'shoulder', intensity: 'mild' }], source: 'user_input' },
      note: 'La última serie costó.',
      createdAt: '2026-09-17T02:31:00.000Z',
      updatedAt: '2026-09-17T02:31:00.000Z',
    } as const;
    const input: RecordPostWorkoutFeedbackInput = {
      effort: 8,
      sensation: 'hard',
      discomfort: [{ area: 'shoulder', intensity: 'mild' }],
      note: 'La última serie costó.',
    };
    global.fetch = jest.fn(async () => jsonResponse(payload)) as unknown as typeof fetch;

    await expect(recordPostWorkoutFeedback(22, input)).resolves.toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith('/api/workouts/22/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  });

  it('fetches feedback and preserves null when absent', async () => {
    global.fetch = jest.fn(async () => jsonResponse(null)) as unknown as typeof fetch;

    await expect(fetchPostWorkoutFeedback(22)).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledWith('/api/workouts/22/feedback');
  });

  it('rejects malformed successful responses instead of treating them as absent feedback', async () => {
    global.fetch = jest.fn(async () => textResponse('not-json')) as unknown as typeof fetch;

    await expect(fetchPostWorkoutFeedback(22)).rejects.toMatchObject({
      name: 'PostWorkoutFeedbackClientError',
      kind: 'generic',
      status: 200,
    });
  });

  it('throws a typed error when the API responds with non-2xx', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'VALIDATION', message: 'Feedback post-entrenamiento inválido' }, 400),
    ) as unknown as typeof fetch;

    await expect(
      recordPostWorkoutFeedback(22, { effort: 11, sensation: 'great', discomfort: [] }),
    ).rejects.toMatchObject({
      name: 'PostWorkoutFeedbackClientError',
      kind: 'validation',
      status: 400,
      api: { code: 'VALIDATION', message: 'Feedback post-entrenamiento inválido' },
    });
  });
});
