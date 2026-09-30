/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import { SESSION_COPY } from '@/lib/copy/session';
import { useExerciseSessionMemory } from './useExerciseSessionMemory';
import type {
  ExerciseSessionContext,
  WorkoutExerciseNote,
} from '@/types/exercise-session-memory';

type FetchInit = { method?: string; body?: string };

const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function noteRecord(overrides: Partial<WorkoutExerciseNote> = {}): WorkoutExerciseNote {
  return {
    id: 5,
    userId: 1,
    workoutId: 1,
    exerciseId: 10,
    note: 'Subir a 42.5 kg si sale liviano.',
    version: 1,
    createdAt: '2026-09-29T10:00:00.000Z',
    updatedAt: '2026-09-29T10:05:00.000Z',
    ...overrides,
  };
}

function emptyContext(overrides: Partial<ExerciseSessionContext> = {}): ExerciseSessionContext {
  return {
    workoutId: 1,
    exerciseId: 10,
    currentNote: null,
    lastCompletedSets: null,
    lastCompletedNote: null,
    ...overrides,
  };
}

function contextUrl(exerciseId: number): string {
  return `/api/workouts/1/exercises/${exerciseId}/context`;
}

function noteUrl(exerciseId: number): string {
  return `/api/workouts/1/exercises/${exerciseId}/note`;
}

function mockFetch(
  routes: Record<string, () => Response>,
): jest.MockedFunction<typeof fetch> {
  const fetchMock = jest.fn(async (input: string | URL | Request, init?: FetchInit) => {
    const url = typeof input === 'string' ? input : String(input);
    const method = init?.method ?? 'GET';
    const route = routes[`${method} ${url}`];
    if (!route) {
      throw new Error(`Unexpected request: ${method} ${url}`);
    }
    return route();
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock as unknown as jest.MockedFunction<typeof fetch>;
}

async function waitLoaded(result: { current: { loading: boolean } }): Promise<void> {
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

describe('useExerciseSessionMemory', () => {
  it('loads an empty context with honest nulls and no error', async () => {
    mockFetch({ [`GET ${contextUrl(10)}`]: () => jsonResponse(emptyContext()) });

    const { result } = renderHook(() =>
      useExerciseSessionMemory({ workoutId: 1, exerciseId: 10 }),
    );

    expect(result.current.loading).toBe(true);
    await waitLoaded(result);

    expect(result.current.context).toEqual(emptyContext());
    expect(result.current.error).toBeNull();
    expect(result.current.saving).toBe(false);
  });

  it('maps a load failure to an explicit error and keeps the context null', async () => {
    mockFetch({
      [`GET ${contextUrl(10)}`]: () =>
        jsonResponse({ code: 'SERVICE_UNAVAILABLE', message: 'boom' }, 500),
    });

    const { result } = renderHook(() =>
      useExerciseSessionMemory({ workoutId: 1, exerciseId: 10 }),
    );
    await waitLoaded(result);

    expect(result.current.context).toBeNull();
    expect(result.current.error).toEqual({
      kind: 'load',
      message: SESSION_COPY.notesLoadError,
    });
  });

  it('creates a note with the null compare-and-swap token and refetches server truth', async () => {
    let stored: WorkoutExerciseNote | null = null;
    const fetchMock = mockFetch({
      [`GET ${contextUrl(10)}`]: () => jsonResponse(emptyContext({ currentNote: stored })),
      [`PUT ${noteUrl(10)}`]: () => {
        stored = noteRecord();
        return jsonResponse(stored);
      },
    });

    const { result } = renderHook(() =>
      useExerciseSessionMemory({ workoutId: 1, exerciseId: 10 }),
    );
    await waitLoaded(result);

    let ok = false;
    await act(async () => {
      ok = await result.current.saveNote('Subir a 42.5 kg si sale liviano.');
    });

    expect(ok).toBe(true);
    expect(result.current.error).toBeNull();
    await waitFor(() => {
      expect(result.current.context?.currentNote?.note).toBe(
        'Subir a 42.5 kg si sale liviano.',
      );
    });

    const putCall = fetchMock.mock.calls.find(
      (call) => (call[1] as FetchInit | undefined)?.method === 'PUT',
    );
    expect(JSON.parse((putCall?.[1] as FetchInit).body as string)).toEqual({
      note: 'Subir a 42.5 kg si sale liviano.',
      expectedNoteId: null,
      expectedVersion: null,
    });
  });

  it('updates an existing note with its id/version compare-and-swap token', async () => {
    let stored = noteRecord({ id: 7, version: 3, note: 'Versión vieja.' });
    const fetchMock = mockFetch({
      [`GET ${contextUrl(10)}`]: () => jsonResponse(emptyContext({ currentNote: stored })),
      [`PUT ${noteUrl(10)}`]: () => {
        stored = noteRecord({ id: 7, version: 4, note: 'Versión nueva.' });
        return jsonResponse(stored);
      },
    });

    const { result } = renderHook(() =>
      useExerciseSessionMemory({ workoutId: 1, exerciseId: 10 }),
    );
    await waitLoaded(result);

    await act(async () => {
      await result.current.saveNote('Versión nueva.');
    });

    const putCall = fetchMock.mock.calls.find(
      (call) => (call[1] as FetchInit | undefined)?.method === 'PUT',
    );
    expect(JSON.parse((putCall?.[1] as FetchInit).body as string)).toEqual({
      note: 'Versión nueva.',
      expectedNoteId: 7,
      expectedVersion: 3,
    });
    await waitFor(() => {
      expect(result.current.context?.currentNote?.version).toBe(4);
    });
  });

  it('accepts 280 astral code points and rejects 281 before any write', async () => {
    const stored: WorkoutExerciseNote | null = null;
    const fetchMock = mockFetch({
      [`GET ${contextUrl(10)}`]: () => jsonResponse(emptyContext({ currentNote: stored })),
      [`PUT ${noteUrl(10)}`]: () => jsonResponse(noteRecord({ note: '😀'.repeat(280) })),
    });

    const { result } = renderHook(() =>
      useExerciseSessionMemory({ workoutId: 1, exerciseId: 10 }),
    );
    await waitLoaded(result);

    let ok = false;
    await act(async () => {
      ok = await result.current.saveNote('😀'.repeat(280));
    });
    expect(ok).toBe(true);

    const putCallsBefore = fetchMock.mock.calls.filter(
      (call) => (call[1] as FetchInit | undefined)?.method === 'PUT',
    ).length;
    expect(putCallsBefore).toBe(1);

    await act(async () => {
      ok = await result.current.saveNote('😀'.repeat(281));
    });
    expect(ok).toBe(false);
    expect(result.current.error).toEqual({
      kind: 'validation',
      message: SESSION_COPY.notesTooLong(280),
    });

    const putCallsAfter = fetchMock.mock.calls.filter(
      (call) => (call[1] as FetchInit | undefined)?.method === 'PUT',
    ).length;
    expect(putCallsAfter).toBe(1);
  });

  it('deletes the current note with the exact token and refetches', async () => {
    let stored: WorkoutExerciseNote | null = noteRecord({ id: 9, version: 2 });
    const fetchMock = mockFetch({
      [`GET ${contextUrl(10)}`]: () => jsonResponse(emptyContext({ currentNote: stored })),
      [`DELETE ${noteUrl(10)}`]: () => {
        stored = null;
        return jsonResponse({ note: null });
      },
    });

    const { result } = renderHook(() =>
      useExerciseSessionMemory({ workoutId: 1, exerciseId: 10 }),
    );
    await waitLoaded(result);

    await act(async () => {
      await result.current.deleteNote();
    });

    const deleteCall = fetchMock.mock.calls.find(
      (call) => (call[1] as FetchInit | undefined)?.method === 'DELETE',
    );
    expect(JSON.parse((deleteCall?.[1] as FetchInit).body as string)).toEqual({
      expectedNoteId: 9,
      expectedVersion: 2,
    });
    await waitFor(() => {
      expect(result.current.context?.currentNote).toBeNull();
    });
  });

  it('surfaces a conflict and refetches the server truth', async () => {
    const stale = noteRecord({ id: 7, version: 1, note: 'Nota vieja.' });
    const serverTruth = noteRecord({ id: 7, version: 5, note: 'Nota del servidor.' });
    let conflicted = false;
    const fetchMock = mockFetch({
      [`GET ${contextUrl(10)}`]: () =>
        jsonResponse(emptyContext({ currentNote: conflicted ? serverTruth : stale })),
      [`PUT ${noteUrl(10)}`]: () => {
        conflicted = true;
        return jsonResponse({ code: 'CONFLICT', message: 'stale' }, 409);
      },
    });

    const { result } = renderHook(() =>
      useExerciseSessionMemory({ workoutId: 1, exerciseId: 10 }),
    );
    await waitLoaded(result);

    let ok = true;
    await act(async () => {
      ok = await result.current.saveNote('Intento con token viejo.');
    });

    expect(ok).toBe(false);
    expect(result.current.error).toEqual({
      kind: 'conflict',
      message: SESSION_COPY.notesConflict,
    });
    await waitFor(() => {
      expect(result.current.context?.currentNote?.version).toBe(5);
    });
    expect(result.current.context?.currentNote?.note).toBe('Nota del servidor.');

    const putCall = fetchMock.mock.calls.find(
      (call) => (call[1] as FetchInit | undefined)?.method === 'PUT',
    );
    expect(JSON.parse((putCall?.[1] as FetchInit).body as string)).toEqual({
      note: 'Intento con token viejo.',
      expectedNoteId: 7,
      expectedVersion: 1,
    });
  });

  it('never lets a stale exercise response overwrite the current exercise', async () => {
    let resolveFirst: ((value: Response) => void) | undefined;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const secondContext = emptyContext({
      exerciseId: 20,
      currentNote: noteRecord({ id: 44, exerciseId: 20, note: 'Sentadilla: 100 kg.' }),
    });

    global.fetch = jest.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : String(input);
      if (url === contextUrl(10)) {
        return firstResponse;
      }
      if (url === contextUrl(20)) {
        return jsonResponse(secondContext);
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;

    const { result, rerender } = renderHook(
      (props: { exerciseId: number }) =>
        useExerciseSessionMemory({ workoutId: 1, exerciseId: props.exerciseId }),
      { initialProps: { exerciseId: 10 } },
    );

    rerender({ exerciseId: 20 });
    await waitFor(() => {
      expect(result.current.context?.exerciseId).toBe(20);
    });

    resolveFirst?.(jsonResponse(emptyContext()));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.context?.exerciseId).toBe(20);
    expect(result.current.context?.currentNote?.note).toBe('Sentadilla: 100 kg.');
  });

  it('refetches the current exercise on reload', async () => {
    let version = 0;
    mockFetch({
      [`GET ${contextUrl(10)}`]: () =>
        jsonResponse(
          emptyContext({
            currentNote: noteRecord({ note: version === 0 ? 'Primera.' : 'Segunda.' }),
          }),
        ),
    });

    const { result } = renderHook(() =>
      useExerciseSessionMemory({ workoutId: 1, exerciseId: 10 }),
    );
    await waitLoaded(result);
    expect(result.current.context?.currentNote?.note).toBe('Primera.');

    version = 1;
    act(() => {
      result.current.reload();
    });
    await waitFor(() => {
      expect(result.current.context?.currentNote?.note).toBe('Segunda.');
    });
  });
});
