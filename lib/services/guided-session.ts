import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { fetchGeminiNextExercise } from '@/lib/ai/gemini';
import { SESSION_COPY } from '@/lib/copy/session';
import { db } from '@/lib/db/client';
import { exercises, workoutSets, workouts } from '@/lib/db/schema';
import { compareMaxWeight } from '@/lib/session/compare-sets';
import { completedExerciseIdsForRoutine } from '@/lib/session/progress';
import { resolveNextExerciseSuggestion } from '@/lib/session/resolve-next';
import { getRoutineById } from '@/lib/services/routines';
import { getStreakForUser } from '@/lib/services/streaks';
import { getWorkoutById } from '@/lib/services/workouts';
import { AppError } from '@/types/errors';
import type {
  ExerciseImprovement,
  GeminiNextExercisePayload,
  GuidedCloseSummary,
  NextExerciseSuggestion,
} from '@/types/routine';

export { completedExerciseIdsForRoutine, isExerciseComplete } from '@/lib/session/progress';

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

  const routine = await getRoutineById(workout.routineId, userId);
  const orderedIds = routine.exercises.map((item) => item.exerciseId);
  const completedIds = completedExerciseIdsForRoutine(routine, workout.sets);

  const remaining = routine.exercises.filter((item) => !completedIds.includes(item.exerciseId));
  if (remaining.length === 0) {
    return {
      source: 'fallback',
      isLast: true,
      nextExerciseId: null,
      message: SESSION_COPY.lastExerciseDone,
    };
  }

  const lastCompleted = [...routine.exercises]
    .reverse()
    .find((item) => completedIds.includes(item.exerciseId));

  const geminiFn = deps.geminiFn ?? fetchGeminiNextExercise;
  let gemini: GeminiNextExercisePayload | null = null;
  try {
    gemini = await geminiFn({
      completedExerciseName: lastCompleted?.exerciseName ?? remaining[0].exerciseName,
      remaining: remaining.map((item) => ({ id: item.exerciseId, name: item.exerciseName })),
    });
  } catch {
    gemini = null;
  }

  const fallbackMessage =
    remaining.length === 1 ? SESSION_COPY.lastExercise : SESSION_COPY.fallbackNext;

  return resolveNextExerciseSuggestion({
    orderedExerciseIds: orderedIds,
    completedExerciseIds: completedIds,
    gemini,
    fallbackMessage,
  });
}

export async function getGuidedCloseSummary(
  workoutId: number,
  userId: number,
): Promise<GuidedCloseSummary> {
  const workout = await getWorkoutById(workoutId, userId);
  const streak = await getStreakForUser(userId);

  const byExercise = new Map<number, { name: string; weights: { weightKg: string }[] }>();
  for (const set of workout.sets) {
    const existing = byExercise.get(set.exerciseId);
    if (existing) {
      existing.weights.push({ weightKg: set.weightKg });
    } else {
      const exercise = await db.query.exercises.findFirst({
        where: eq(exercises.id, set.exerciseId),
      });
      byExercise.set(set.exerciseId, {
        name: exercise?.name ?? 'Ejercicio',
        weights: [{ weightKg: set.weightKg }],
      });
    }
  }

  const improvements: ExerciseImprovement[] = [];
  for (const [exerciseId, current] of byExercise) {
    const previousSets = await loadPreviousExerciseSets(userId, exerciseId, workout.id);
    const comparison = compareMaxWeight(current.weights, previousSets);
    improvements.push({
      exerciseId,
      exerciseName: current.name,
      ...comparison,
    });
  }

  return { streak, improvements };
}

async function loadPreviousExerciseSets(
  userId: number,
  exerciseId: number,
  currentWorkoutId: number,
): Promise<{ weightKg: string }[]> {
  const rows = await db
    .select({
      workoutId: workouts.id,
      weightKg: workoutSets.weightKg,
      startedAt: workouts.startedAt,
    })
    .from(workoutSets)
    .innerJoin(workouts, eq(workoutSets.workoutId, workouts.id))
    .where(
      and(
        eq(workouts.userId, userId),
        eq(workoutSets.exerciseId, exerciseId),
        ne(workouts.id, currentWorkoutId),
        isNull(workouts.deletedAt),
        isNull(workoutSets.deletedAt),
      ),
    )
    .orderBy(desc(workouts.startedAt));

  if (rows.length === 0) {
    return [];
  }

  const latestId = rows[0].workoutId;
  return rows.filter((row) => row.workoutId === latestId).map((row) => ({ weightKg: row.weightKg }));
}
