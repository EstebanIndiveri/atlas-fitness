import type { GeminiNextExercisePayload, NextExerciseSuggestion } from '@/types/routine';

export function remainingExerciseIds(
  orderedExerciseIds: readonly number[],
  completedExerciseIds: Iterable<number>,
): number[] {
  const completed = new Set(completedExerciseIds);
  return orderedExerciseIds.filter((id) => !completed.has(id));
}

export function fallbackNextExercise(
  orderedExerciseIds: readonly number[],
  completedExerciseIds: Iterable<number>,
): { nextExerciseId: number | null; isLast: boolean } {
  const remaining = remainingExerciseIds(orderedExerciseIds, completedExerciseIds);
  if (remaining.length === 0) {
    return { nextExerciseId: null, isLast: true };
  }
  return { nextExerciseId: remaining[0], isLast: remaining.length === 1 };
}

/**
 * Prefer a Gemini pick only when it is still pending in the routine.
 * Invalid / missing payloads fall back to sort_order.
 */
export function resolveNextExerciseSuggestion(args: {
  orderedExerciseIds: readonly number[];
  completedExerciseIds: Iterable<number>;
  gemini: GeminiNextExercisePayload | null;
  fallbackMessage: string;
}): NextExerciseSuggestion {
  const remaining = remainingExerciseIds(args.orderedExerciseIds, args.completedExerciseIds);
  const fallback = fallbackNextExercise(args.orderedExerciseIds, args.completedExerciseIds);

  if (remaining.length === 0) {
    return {
      source: 'fallback',
      isLast: true,
      nextExerciseId: null,
      message: args.gemini?.message?.trim() || args.fallbackMessage,
    };
  }

  const suggestedId = args.gemini?.nextExerciseId ?? null;
  if (suggestedId !== null && remaining.includes(suggestedId)) {
    return {
      source: 'gemini',
      isLast: remaining.length === 1,
      nextExerciseId: suggestedId,
      message: args.gemini?.message?.trim() || args.fallbackMessage,
    };
  }

  return {
    source: 'fallback',
    isLast: fallback.isLast,
    nextExerciseId: fallback.nextExerciseId,
    message: args.fallbackMessage,
  };
}

export function selectCurrentExercise<T extends { exerciseId: number }>(
  ordered: readonly T[],
  completedExerciseIds: Iterable<number>,
  preferredId: number | null = null,
): T | null {
  const completed = new Set(completedExerciseIds);
  const remaining = ordered.filter((item) => !completed.has(item.exerciseId));
  if (remaining.length === 0) {
    return null;
  }
  if (preferredId !== null) {
    const preferred = remaining.find((item) => item.exerciseId === preferredId);
    if (preferred) {
      return preferred;
    }
  }
  return remaining[0];
}
