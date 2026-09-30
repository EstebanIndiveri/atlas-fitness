import { fetchGeminiNextExercise } from '@/lib/ai/gemini';
import { SESSION_COPY } from '@/lib/copy/session';
import { completedExerciseIdsForRoutine } from '@/lib/session/progress';
import { applyTargetSetsOverrides } from '@/lib/session/queue';
import { resolveNextExerciseSuggestion } from '@/lib/session/resolve-next';
import { getRoutineForWorkout } from '@/lib/services/routines';
import { getStreakForUser } from '@/lib/services/streaks';
import { getWorkoutById } from '@/lib/services/workouts';
import { AppError } from '@/types/errors';
import type {
  GeminiNextExercisePayload,
  GuidedCloseStats,
  GuidedCloseSummary,
  NextExerciseSuggestion,
} from '@/types/routine';

export { completedExerciseIdsForRoutine, isExerciseComplete } from '@/lib/session/progress';

export async function suggestNextExerciseFromRemaining(
  remaining: { id: number; name: string }[],
  lastCompletedName: string | null,
  deps: {
    geminiFn?: typeof fetchGeminiNextExercise;
  } = {},
): Promise<NextExerciseSuggestion> {
  if (remaining.length === 0) {
    return {
      source: 'fallback',
      isLast: true,
      nextExerciseId: null,
      message: SESSION_COPY.lastExerciseDone,
    };
  }

  const geminiFn = deps.geminiFn ?? fetchGeminiNextExercise;
  let gemini: GeminiNextExercisePayload | null = null;
  try {
    gemini = await geminiFn({
      completedExerciseName: lastCompletedName ?? remaining[0].name,
      remaining,
    });
  } catch {
    gemini = null;
  }

  const fallbackMessage =
    remaining.length === 1 ? SESSION_COPY.lastExercise : SESSION_COPY.fallbackNext;

  return resolveNextExerciseSuggestion({
    orderedExerciseIds: remaining.map((item) => item.id),
    completedExerciseIds: [],
    gemini,
    fallbackMessage,
  });
}

export async function suggestNextExerciseForWorkout(
  workoutId: number,
  userId: number,
  deps: {
    geminiFn?: typeof fetchGeminiNextExercise;
  } = {},
): Promise<NextExerciseSuggestion> {
  const workout = await getWorkoutById(workoutId, userId);
  if (!workout.routineId) {
    throw new AppError('VALIDATION', 'Este entrenamiento no está vinculado a una rutina');
  }

  const routine = await getRoutineForWorkout(workout.routineId, userId);
  const adaptedRoutine = {
    ...routine,
    exercises: applyTargetSetsOverrides(
      routine.exercises,
      workout.queue.targetSetsOverrides,
    ),
  };
  const remaining = workout.queue.pendingExerciseIds.flatMap((exerciseId) => {
    const item = routine.exercises.find((exercise) => exercise.exerciseId === exerciseId);
    return item ? [{ id: exerciseId, name: item.exerciseName }] : [];
  });

  const completedIds = completedExerciseIdsForRoutine(adaptedRoutine, workout.sets);
  const lastCompleted = [...adaptedRoutine.exercises]
    .reverse()
    .find((item) => completedIds.includes(item.exerciseId));

  return suggestNextExerciseFromRemaining(
    remaining,
    lastCompleted?.exerciseName ?? null,
    deps,
  );
}

/**
 * Post-close summary of safe facts only: streak plus duration and completed-set
 * count. No max-weight delta and no mixed-mode volume claim is derived here; a
 * truthful PR, when one exists, comes from the versioned progression read model.
 */
export async function getGuidedCloseSummary(
  workoutId: number,
  userId: number,
): Promise<GuidedCloseSummary> {
  const workout = await getWorkoutById(workoutId, userId);
  const streak = await getStreakForUser(userId);
  const stats = buildGuidedCloseStats(workout);
  return { streak, stats };
}

function buildGuidedCloseStats(workout: {
  startedAt: Date;
  endedAt: Date | null;
  sets: { completed: boolean }[];
}): GuidedCloseStats {
  const completedSets = workout.sets.filter((set) => set.completed);
  const durationMinutes = workout.endedAt
    ? Math.round((workout.endedAt.getTime() - workout.startedAt.getTime()) / 60_000)
    : null;

  return {
    durationMinutes,
    completedSets: completedSets.length,
  };
}
