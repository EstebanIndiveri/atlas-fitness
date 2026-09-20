/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useGuidedSession } from './useGuidedSession';
import type { RoutineExerciseItem, RoutineSummary } from '@/types/routine';
import type { WorkoutSet } from '@/lib/db/schema';

type FetchInit = { method?: string; body?: string };

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

function exercise(exerciseId: number, exerciseName: string): RoutineExerciseItem {
  return {
    id: exerciseId,
    routineId: 1,
    exerciseId,
    sortOrder: exerciseId,
    targetSets: 3,
    targetReps: 8,
    exerciseName,
    muscleGroup: 'Pecho',
    instructions: '',
    imageUrl: null,
    videoUrl: null,
  };
}

const routine: RoutineSummary = {
  id: 1,
  slug: 'empuje',
  name: 'Empuje',
  description: null,
  kind: 'gym',
  restSeconds: 90,
  isSystem: true,
  exercises: [
    exercise(10, 'Press Banca'),
    exercise(20, 'Sentadilla'),
    exercise(30, 'Remo'),
  ],
};

const finishedSets: WorkoutSet[] = [
  {
    id: 1,
    workoutId: 8,
    exerciseId: 10,
    setIndex: 1,
    reps: 8,
    weightKg: '40.5',
    completed: true,
    deletedAt: null,
  },
  {
    id: 2,
    workoutId: 8,
    exerciseId: 10,
    setIndex: 2,
    reps: 8,
    weightKg: '42.5',
    completed: true,
    deletedAt: null,
  },
];

const workout = {
  id: 8,
  routineId: 1,
  endedAt: null,
  sets: finishedSets,
};

function suggestion(nextExerciseId: number | null, extra: { isLast?: boolean } = {}) {
  return {
    source: 'fallback' as const,
    isLast: extra.isLast ?? nextExerciseId === null,
    nextExerciseId,
    message: 'Siguiente según el orden de la rutina.',
  };
}

function readMethod(init?: FetchInit): string {
  return init?.method ?? 'GET';
}

describe('useGuidedSession skip/hold', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('advances to the next exercise on skip and leaves finished sets untouched', async () => {
    global.fetch = jest.fn(async (input: string, init?: FetchInit) => {
      const url = String(input);
      const method = readMethod(init);
      if (url === '/api/workouts/8' && method === 'GET') {
        return jsonResponse(workout);
      }
      if (url === '/api/routines/1') {
        return jsonResponse(routine);
      }
      if (url === '/api/workouts/8/skip' && method === 'POST') {
        return jsonResponse({
          action: 'skip',
          clientMutationId: 'mut-skip',
          duplicate: false,
          queue: {
            pendingExerciseIds: [20, 30],
            skippedExerciseIds: [10],
            heldExerciseIds: [],
          },
          suggestion: suggestion(20),
          sets: finishedSets.map((set) => ({
            id: set.id,
            exerciseId: set.exerciseId,
            setIndex: set.setIndex,
            reps: set.reps,
            weightKg: set.weightKg,
          })),
        });
      }
      return jsonResponse({ code: 'NOT_FOUND', message: url }, 404);
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useGuidedSession('8'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.current?.exerciseId).toBe(10);

    await act(async () => {
      await result.current.skipCurrent();
    });

    expect(result.current.current?.exerciseId).toBe(20);
    expect(result.current.current?.exerciseName).toBe('Sentadilla');
    expect(result.current.workout?.sets).toEqual(finishedSets);
    expect(result.current.workout?.sets.map((set) => set.weightKg)).toEqual(['40.5', '42.5']);
  });

  it('holds the current exercise so it reappears after the others', async () => {
    global.fetch = jest.fn(async (input: string, init?: FetchInit) => {
      const url = String(input);
      const method = readMethod(init);
      if (url === '/api/workouts/8' && method === 'GET') {
        return jsonResponse(workout);
      }
      if (url === '/api/routines/1') {
        return jsonResponse(routine);
      }
      if (url === '/api/workouts/8/hold' && method === 'POST') {
        return jsonResponse({
          action: 'hold',
          clientMutationId: 'mut-hold',
          duplicate: false,
          queue: {
            pendingExerciseIds: [20, 30, 10],
            skippedExerciseIds: [],
            heldExerciseIds: [10],
          },
          suggestion: suggestion(20),
        });
      }
      if (url === '/api/workouts/8/skip' && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}')) as { exerciseId: number };
        if (body.exerciseId === 20) {
          return jsonResponse({
            action: 'skip',
            clientMutationId: 'mut-skip-20',
            duplicate: false,
            queue: {
              pendingExerciseIds: [30, 10],
              skippedExerciseIds: [20],
              heldExerciseIds: [10],
            },
            suggestion: suggestion(30),
          });
        }
        return jsonResponse({
          action: 'skip',
          clientMutationId: 'mut-skip-30',
          duplicate: false,
          queue: {
            pendingExerciseIds: [10],
            skippedExerciseIds: [20, 30],
            heldExerciseIds: [10],
          },
          suggestion: suggestion(10),
        });
      }
      return jsonResponse({ code: 'NOT_FOUND', message: url }, 404);
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useGuidedSession('8'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.holdCurrent();
    });
    expect(result.current.current?.exerciseId).toBe(20);

    await act(async () => {
      await result.current.skipCurrent();
    });
    expect(result.current.current?.exerciseId).toBe(30);

    await act(async () => {
      await result.current.skipCurrent();
    });
    expect(result.current.current?.exerciseId).toBe(10);
    expect(result.current.current?.exerciseName).toBe('Press Banca');
    expect(result.current.workout?.sets).toEqual(finishedSets);
  });

  it('shows a 400 error when the workout is not active and does not mutate sets', async () => {
    global.fetch = jest.fn(async (input: string, init?: FetchInit) => {
      const url = String(input);
      const method = readMethod(init);
      if (url === '/api/workouts/8' && method === 'GET') {
        return jsonResponse(workout);
      }
      if (url === '/api/routines/1') {
        return jsonResponse(routine);
      }
      if (url.endsWith('/skip') && method === 'POST') {
        return jsonResponse({ code: 'VALIDATION', message: 'El entrenamiento no está activo.' }, 400);
      }
      return jsonResponse({ code: 'NOT_FOUND', message: url }, 404);
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useGuidedSession('8'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.skipCurrent();
    });

    expect(result.current.actionError).toBe('El entrenamiento no está activo.');
    expect(result.current.current?.exerciseId).toBe(10);
    expect(result.current.workout?.sets).toEqual(finishedSets);
  });
});
