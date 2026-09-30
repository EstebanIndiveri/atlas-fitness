import { describe, expect, it } from '@jest/globals';
import { SESSION_COPY } from '@/lib/copy/session';
import {
  mapSessionQueueHttpError,
  parseWorkoutQueueActionResponse,
  parseWorkoutQueueState,
} from './parse-action';

describe('parseWorkoutQueueState', () => {
  it('accepts integer id arrays', () => {
    expect(
      parseWorkoutQueueState({
        pendingExerciseIds: [20, 10],
        skippedExerciseIds: [],
        heldExerciseIds: [10],
      }),
    ).toEqual({
      pendingExerciseIds: [20, 10],
      skippedExerciseIds: [],
      heldExerciseIds: [10],
    });
  });

  it('rejects non-integer ids', () => {
    expect(
      parseWorkoutQueueState({
        pendingExerciseIds: [20.5],
        skippedExerciseIds: [],
        heldExerciseIds: [],
      }),
    ).toBeNull();
  });
});

describe('parseWorkoutQueueActionResponse', () => {
  it('parses skip/hold payloads including decimal weight snapshots', () => {
    const parsed = parseWorkoutQueueActionResponse({
      action: 'skip',
      clientMutationId: 'mut-1',
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
        message: 'Siguiente según el orden de la rutina.',
      },
      sets: [
        {
          id: 1,
          exerciseId: 10,
          setIndex: 1,
          reps: 8,
          weightKg: '40.5',
        },
      ],
    });

    expect(parsed?.action).toBe('skip');
    expect(parsed?.sets?.[0].weightKg).toBe('40.5');
    expect(parsed?.suggestion.nextExerciseId).toBe(20);
    // An omitted tuple is an explicit unknown, never inferred.
    expect(parsed?.sets?.[0].semanticCaptureVersion).toBeNull();
    expect(parsed?.sets?.[0].loadMode).toBeNull();
  });

  it('preserves a declared semantic tuple through the transport', () => {
    const parsed = parseWorkoutQueueActionResponse({
      action: 'hold',
      clientMutationId: 'mut-2',
      duplicate: false,
      queue: { pendingExerciseIds: [10], skippedExerciseIds: [], heldExerciseIds: [] },
      suggestion: { source: 'fallback', isLast: false, nextExerciseId: 10, message: 'x' },
      sets: [
        {
          id: 2,
          exerciseId: 10,
          setIndex: 1,
          reps: 8,
          weightKg: '0',
          semanticCaptureVersion: 1,
          loadMode: 'bodyweight',
          amountBasis: null,
          side: 'bilateral',
          setPurpose: 'working',
          repCountBasis: null,
        },
      ],
    });

    expect(parsed?.sets?.[0].semanticCaptureVersion).toBe(1);
    expect(parsed?.sets?.[0].loadMode).toBe('bodyweight');
    expect(parsed?.sets?.[0].amountBasis).toBeNull();
  });

  it('rejects a malformed semantic tuple instead of inventing semantics', () => {
    const parsed = parseWorkoutQueueActionResponse({
      action: 'skip',
      clientMutationId: 'mut-3',
      duplicate: false,
      queue: { pendingExerciseIds: [10], skippedExerciseIds: [], heldExerciseIds: [] },
      suggestion: { source: 'fallback', isLast: false, nextExerciseId: 10, message: 'x' },
      sets: [
        {
          id: 3,
          exerciseId: 10,
          setIndex: 1,
          reps: 8,
          weightKg: '50',
          semanticCaptureVersion: 1,
          loadMode: 5,
          amountBasis: null,
          side: null,
          setPurpose: null,
          repCountBasis: null,
        },
      ],
    });

    expect(parsed).toBeNull();
  });
});

describe('mapSessionQueueHttpError', () => {
  it('surfaces 400 VALIDATION when the workout is not active', () => {
    const error = mapSessionQueueHttpError(400, {
      code: 'VALIDATION',
      message: 'El entrenamiento no está activo.',
    });
    expect(error.kind).toBe('not_active');
    expect(error.status).toBe(400);
    expect(error.message).toBe('El entrenamiento no está activo.');
  });

  it('falls back to session copy when 400 has no body', () => {
    const error = mapSessionQueueHttpError(400, null);
    expect(error.message).toBe(SESSION_COPY.errorNotActive);
  });
});
