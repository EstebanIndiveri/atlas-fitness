import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { fetchGeminiNextExercise } from '@/lib/ai/gemini';
import { SESSION_COPY } from '@/lib/copy/session';
import { db } from '@/lib/db/client';
import { exercises, workoutSets, workouts } from '@/lib/db/schema';
import { compareMaxWeight } from '@/lib/session/compare-sets';
import { completedExerciseIdsForRoutine } from '@/lib/session/progress';
import { applyTargetSetsOverrides } from '@/lib/session/queue';
import { resolveNextExerciseSuggestion } from '@/lib/session/resolve-next';
import { getRoutineForWorkout } from '@/lib/services/routines';
import { getStreakForUser } from '@/lib/services/streaks';
import { getWorkoutById } from '@/lib/services/workouts';
import { AppError } from '@/types/errors';
import type {
  ExerciseImprovement,
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

export async function getGuidedCloseSummary(
  workoutId: number,
  userId: number,
): Promise<GuidedCloseSummary> {
  const workout = await getWorkoutById(workoutId, userId);
  const streak = await getStreakForUser(userId);
  const stats = buildGuidedCloseStats(workout);

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

  return { streak, improvements, stats };
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

function buildGuidedCloseStats(workout: {
  startedAt: Date;
  endedAt: Date | null;
  sets: { reps: number; weightKg: string; completed: boolean }[];
}): GuidedCloseStats {
  const completedSets = workout.sets.filter((set) => set.completed);
  const durationMinutes = workout.endedAt
    ? Math.round((workout.endedAt.getTime() - workout.startedAt.getTime()) / 60_000)
    : null;

  return {
    durationMinutes,
    completedSets: completedSets.length,
    totalVolumeKg: sumVolumeKg(completedSets),
  };
}

function sumVolumeKg(sets: { reps: number; weightKg: string }[]): string {
  const products = sets.map((set) => multiplyDecimalByInteger(set.weightKg, set.reps));
  const maxScale = products.reduce((current, product) => Math.max(current, product.scale), 0);
  const totalUnits = products.reduce((total, product) => {
    const scaleDelta = maxScale - product.scale;
    return addIntegerStrings(total, `${product.units}${'0'.repeat(scaleDelta)}`);
  }, '0');

  return formatScaledDecimal(totalUnits, maxScale);
}

function multiplyDecimalByInteger(value: string, multiplier: number): { units: string; scale: number } {
  const normalized = value.trim();
  const [wholePart, fractionPart = ''] = normalized.split('.');
  const units = multiplyIntegerString(`${wholePart}${fractionPart}` || '0', multiplier);
  return { units, scale: fractionPart.length };
}

function multiplyIntegerString(value: string, multiplier: number): string {
  let carry = 0;
  let result = '';
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const product = Number(value[index]) * multiplier + carry;
    result = String(product % 10) + result;
    carry = Math.floor(product / 10);
  }
  return `${carry || ''}${result}`.replace(/^0+(?=\d)/, '');
}

function addIntegerStrings(left: string, right: string): string {
  let carry = 0;
  let result = '';
  const maxLength = Math.max(left.length, right.length);
  for (let offset = 0; offset < maxLength; offset += 1) {
    const leftDigit = Number(left[left.length - 1 - offset] ?? '0');
    const rightDigit = Number(right[right.length - 1 - offset] ?? '0');
    const sum = leftDigit + rightDigit + carry;
    result = String(sum % 10) + result;
    carry = Math.floor(sum / 10);
  }
  return `${carry || ''}${result}`.replace(/^0+(?=\d)/, '');
}

function formatScaledDecimal(units: string, scale: number): string {
  if (scale === 0) {
    return units;
  }

  const raw = units.padStart(scale + 1, '0');
  const whole = raw.slice(0, -scale);
  const fraction = raw.slice(-scale).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}
