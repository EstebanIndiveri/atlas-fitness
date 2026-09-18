import { describe, expect, it } from '@jest/globals';
import { fallbackNextExercise, resolveNextExerciseSuggestion, selectCurrentExercise } from './resolve-next';

const ORDERED = [10, 20, 30];

describe('fallbackNextExercise', () => {
  it('returns the first pending exercise in routine order', () => {
    expect(fallbackNextExercise(ORDERED, [])).toEqual({ nextExerciseId: 10, isLast: false });
    expect(fallbackNextExercise(ORDERED, [10])).toEqual({ nextExerciseId: 20, isLast: false });
    expect(fallbackNextExercise(ORDERED, [10, 20])).toEqual({ nextExerciseId: 30, isLast: true });
  });

  it('marks last when the routine is done', () => {
    expect(fallbackNextExercise(ORDERED, [10, 20, 30])).toEqual({
      nextExerciseId: null,
      isLast: true,
    });
  });
});

describe('resolveNextExerciseSuggestion', () => {
  it('uses Gemini when the suggested id is still pending', () => {
    const result = resolveNextExerciseSuggestion({
      orderedExerciseIds: ORDERED,
      completedExerciseIds: [10],
      gemini: { nextExerciseId: 30, isLast: false, message: 'Ahora press militar.' },
      fallbackMessage: 'orden',
    });

    expect(result).toEqual({
      source: 'gemini',
      isLast: false,
      nextExerciseId: 30,
      message: 'Ahora press militar.',
    });
  });

  it('falls back when Gemini suggests a completed or unknown id', () => {
    const result = resolveNextExerciseSuggestion({
      orderedExerciseIds: ORDERED,
      completedExerciseIds: [10],
      gemini: { nextExerciseId: 10, isLast: false, message: 'repetí banca' },
      fallbackMessage: 'Siguiente según el orden de la rutina.',
    });

    expect(result.source).toBe('fallback');
    expect(result.nextExerciseId).toBe(20);
    expect(result.message).toBe('Siguiente según el orden de la rutina.');
  });

  it('falls back when Gemini is null (no key / API fail)', () => {
    const result = resolveNextExerciseSuggestion({
      orderedExerciseIds: ORDERED,
      completedExerciseIds: [10, 20],
      gemini: null,
      fallbackMessage: 'último',
    });

    expect(result).toEqual({
      source: 'fallback',
      isLast: true,
      nextExerciseId: 30,
      message: 'último',
    });
  });
});

describe('selectCurrentExercise', () => {
  it('prefers a suggested remaining id, otherwise first pending', () => {
    const items = [{ exerciseId: 10 }, { exerciseId: 20 }, { exerciseId: 30 }];
    expect(selectCurrentExercise(items, [10], 30)?.exerciseId).toBe(30);
    expect(selectCurrentExercise(items, [10], null)?.exerciseId).toBe(20);
    expect(selectCurrentExercise(items, [10, 20, 30], 10)).toBeNull();
  });
});
