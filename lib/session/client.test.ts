import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { postWorkoutQueueAction, SessionQueueClientError } from './client';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('postWorkoutQueueAction', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('POSTs a typed skip action with clientMutationId', async () => {
    const fetchMock = jest.fn(async () =>
      jsonResponse({
        action: 'skip',
        clientMutationId: 'abc',
        duplicate: false,
        queue: {
          pendingExerciseIds: [20],
          skippedExerciseIds: [10],
          heldExerciseIds: [],
        },
        suggestion: {
          source: 'fallback',
          isLast: true,
          nextExerciseId: 20,
          message: 'ok',
        },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await postWorkoutQueueAction({
      workoutId: 8,
      action: 'skip',
      exerciseId: 10,
      clientMutationId: 'abc',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/workouts/8/skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exerciseId: 10, clientMutationId: 'abc' }),
    });
    expect(result.queue.pendingExerciseIds).toEqual([20]);
    expect(result.duplicate).toBe(false);
  });

  it('throws a 400 not_active error for an inactive workout', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'VALIDATION', message: 'El entrenamiento no está activo.' }, 400),
    ) as unknown as typeof fetch;

    await expect(
      postWorkoutQueueAction({
        workoutId: 8,
        action: 'hold',
        exerciseId: 10,
        clientMutationId: 'abc',
      }),
    ).rejects.toMatchObject({
      name: 'SessionQueueClientError',
      kind: 'not_active',
      status: 400,
      message: 'El entrenamiento no está activo.',
    } satisfies Partial<SessionQueueClientError>);
  });
});
