/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  deleteWorkoutExerciseNote,
  fetchExerciseSessionContext,
  putWorkoutExerciseNote,
} from './exercise-session-memory';

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

const NOTE = {
  id: 9,
  userId: 1,
  workoutId: 7,
  exerciseId: 3,
  note: 'recordar subir',
  version: 2,
  createdAt: '2026-09-18T12:00:00.000Z',
  updatedAt: '2026-09-18T12:00:00.000Z',
};

// `2026-09-17T02:00:00.000Z` is 2026-09-16 23:00 in Córdoba (UTC−3).
const CONTEXT = {
  workoutId: 7,
  exerciseId: 3,
  currentNote: NOTE,
  lastCompletedSets: {
    workoutId: 5,
    exerciseId: 3,
    localDate: '2026-09-16',
    endedAt: '2026-09-17T02:00:00.000Z',
    sets: [
      { id: 1, exerciseId: 3, setIndex: 1, reps: 8, weightKg: '62.75' },
      { id: 2, exerciseId: 3, setIndex: 2, reps: 6, weightKg: '70' },
    ],
  },
  // Independent source: different workout and date than the sets source.
  lastCompletedNote: {
    workoutId: 4,
    exerciseId: 3,
    localDate: '2026-09-14',
    endedAt: '2026-09-15T02:00:00.000Z',
    noteId: 6,
    note: 'bajar volumen',
    version: 1,
  },
};

function asContext(overrides: Record<string, unknown>): Record<string, unknown> {
  return { ...CONTEXT, ...overrides };
}

describe('exercise-session memory client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches context and preserves exact decimal weights and independent sources', async () => {
    global.fetch = jest.fn(async () => jsonResponse(CONTEXT)) as unknown as typeof fetch;

    await expect(fetchExerciseSessionContext(7, 3)).resolves.toEqual(CONTEXT);
    expect(global.fetch).toHaveBeenCalledWith('/api/workouts/7/exercises/3/context');
  });

  it('rejects a context whose local date does not match the endedAt instant', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse(
        asContext({
          lastCompletedSets: { ...CONTEXT.lastCompletedSets, localDate: '2026-09-17' },
        }),
      ),
    ) as unknown as typeof fetch;

    await expect(fetchExerciseSessionContext(7, 3)).rejects.toMatchObject({
      name: 'ExerciseSessionMemoryClientError',
      kind: 'generic',
      status: 200,
    });
  });

  it('rejects a context with a malformed endedAt instant', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse(
        asContext({
          lastCompletedSets: { ...CONTEXT.lastCompletedSets, endedAt: 'not-an-instant' },
        }),
      ),
    ) as unknown as typeof fetch;

    await expect(fetchExerciseSessionContext(7, 3)).rejects.toMatchObject({
      name: 'ExerciseSessionMemoryClientError',
      kind: 'generic',
      status: 200,
    });
  });

  it('rejects numeric weightKg instead of coercing it to a string', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse(
        asContext({
          lastCompletedSets: {
            ...CONTEXT.lastCompletedSets,
            sets: [{ id: 1, exerciseId: 3, setIndex: 1, reps: 8, weightKg: 62.75 }],
          },
        }),
      ),
    ) as unknown as typeof fetch;

    await expect(fetchExerciseSessionContext(7, 3)).rejects.toMatchObject({
      name: 'ExerciseSessionMemoryClientError',
      kind: 'generic',
      status: 200,
    });
  });

  it('rejects a cross-source shape where history points at the current workout', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse(
        asContext({
          lastCompletedSets: { ...CONTEXT.lastCompletedSets, workoutId: 7 },
        }),
      ),
    ) as unknown as typeof fetch;

    await expect(fetchExerciseSessionContext(7, 3)).rejects.toMatchObject({
      name: 'ExerciseSessionMemoryClientError',
      kind: 'generic',
      status: 200,
    });
  });

  it('rejects a context with unknown extra fields', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse(asContext({ recommendedNextWeightKg: '80' })),
    ) as unknown as typeof fetch;

    await expect(fetchExerciseSessionContext(7, 3)).rejects.toMatchObject({
      name: 'ExerciseSessionMemoryClientError',
      kind: 'generic',
      status: 200,
    });
  });

  it('rejects a non-JSON successful context body', async () => {
    global.fetch = jest.fn(async () => textResponse('not-json')) as unknown as typeof fetch;

    await expect(fetchExerciseSessionContext(7, 3)).rejects.toMatchObject({
      name: 'ExerciseSessionMemoryClientError',
      kind: 'generic',
      status: 200,
    });
  });

  it('puts a note with only the token and text fields and returns the persisted note', async () => {
    global.fetch = jest.fn(async () => jsonResponse(NOTE)) as unknown as typeof fetch;

    const input = {
      workoutId: 7,
      exerciseId: 3,
      note: 'recordar subir',
      expectedNoteId: 9,
      expectedVersion: 1,
    };

    await expect(putWorkoutExerciseNote(input)).resolves.toEqual(NOTE);
    expect(global.fetch).toHaveBeenCalledWith('/api/workouts/7/exercises/3/note', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        note: 'recordar subir',
        expectedNoteId: 9,
        expectedVersion: 1,
      }),
    });
  });

  it('rejects a malformed note success body', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ ...NOTE, version: 0 }),
    ) as unknown as typeof fetch;

    await expect(
      putWorkoutExerciseNote({
        workoutId: 7,
        exerciseId: 3,
        note: 'recordar subir',
        expectedNoteId: null,
        expectedVersion: null,
      }),
    ).rejects.toMatchObject({
      name: 'ExerciseSessionMemoryClientError',
      kind: 'generic',
      status: 200,
    });
  });

  it('deletes a note and preserves the {note:null} shape', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ note: null })) as unknown as typeof fetch;

    await expect(
      deleteWorkoutExerciseNote({
        workoutId: 7,
        exerciseId: 3,
        expectedNoteId: 9,
        expectedVersion: 2,
      }),
    ).resolves.toEqual({ note: null });
    expect(global.fetch).toHaveBeenCalledWith('/api/workouts/7/exercises/3/note', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedNoteId: 9, expectedVersion: 2 }),
    });
  });

  it('rejects a delete success body that is not {note:null}', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ note: 'still here' })) as unknown as typeof fetch;

    await expect(
      deleteWorkoutExerciseNote({
        workoutId: 7,
        exerciseId: 3,
        expectedNoteId: 9,
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({
      name: 'ExerciseSessionMemoryClientError',
      kind: 'generic',
      status: 200,
    });
  });

  it.each([
    [401, 'UNAUTHORIZED', 'unauthorized'],
    [403, 'FORBIDDEN', 'forbidden'],
    [404, 'NOT_FOUND', 'not_found'],
    [400, 'VALIDATION', 'validation'],
    [409, 'CONFLICT', 'conflict'],
    [500, 'SERVICE_UNAVAILABLE', 'generic'],
  ] as const)('maps HTTP %i %s to %s', async (status, code, kind) => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ code, message: `message-${code}` }, status),
    ) as unknown as typeof fetch;

    await expect(fetchExerciseSessionContext(7, 3)).rejects.toMatchObject({
      name: 'ExerciseSessionMemoryClientError',
      kind,
      status,
      api: { code, message: `message-${code}` },
    });
  });
});
