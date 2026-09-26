import { createWorkout } from '@/lib/services/workouts';
import {
  decideCoachRecommendation,
  recordCoachRecommendation,
} from '@/lib/services/coach-recommendation';
import type { CoachRecommendationDto } from '@/lib/services/coach-recommendation';
import type { Workout } from '@/lib/db/schema';
import type { CoachAdaptationResult } from '@/types/coach';

export interface StartAdaptedWorkoutInput {
  userId: number;
  routineId: number;
  trainingPlanId?: number;
  result: CoachAdaptationResult;
  contextSnapshot?: unknown;
  dailyCheckInId?: number;
}

export interface StartAdaptedWorkoutResult {
  workout: Workout;
  /**
   * The accepted recommendation, or null when the workout started but persisting
   * the recommendation failed (best-effort traceability, non-fatal).
   */
  recommendation: CoachRecommendationDto | null;
}

function removedExerciseIds(result: CoachAdaptationResult): number[] {
  return result.exerciseDeltas
    .filter((delta) => delta.action === 'removed')
    .map((delta) => delta.exerciseId);
}

function reducedTargetSetsOverrides(
  result: CoachAdaptationResult,
): Record<number, number> {
  return result.exerciseDeltas.reduce<Record<number, number>>((overrides, delta) => {
    if (delta.action === 'reduced' && delta.toSets > 0 && delta.toSets < delta.fromSets) {
      overrides[delta.exerciseId] = delta.toSets;
    }
    return overrides;
  }, {});
}

/**
 * Starts a guided workout from an accepted Coach Atlas adaptation: creates the
 * workout with removed exercises pre-skipped in the queue, then records the
 * recommendation and marks it accepted for full traceability.
 *
 * Workout creation (including the adapted queue) is the critical path. Persisting
 * the recommendation is best-effort: if it fails, the started workout is returned
 * with `recommendation: null` and the error is logged with context, never swallowed.
 *
 * @param input Owner, routine, adaptation result, and optional context.
 * @returns The started workout and the accepted recommendation (or null on record failure).
 * @throws {AppError} VALIDATION for an invalid routine, CONFLICT when another workout is active.
 * @example
 * await startAdaptedWorkout({ userId: 1, routineId: 7, result });
 */
export async function startAdaptedWorkout(
  input: StartAdaptedWorkoutInput,
): Promise<StartAdaptedWorkoutResult> {
  const { userId, routineId, trainingPlanId, result, contextSnapshot, dailyCheckInId } = input;

  const workout = await createWorkout(userId, routineId, {
    skippedExerciseIds: removedExerciseIds(result),
    targetSetsOverrides: reducedTargetSetsOverrides(result),
    ...(trainingPlanId !== undefined ? { trainingPlanId } : {}),
  });

  try {
    const recorded = await recordCoachRecommendation({
      userId,
      workoutId: workout.id,
      source: result.source,
      result,
      ...(contextSnapshot !== undefined ? { contextSnapshot } : {}),
      ...(dailyCheckInId !== undefined ? { dailyCheckInId } : {}),
    });
    const decided = await decideCoachRecommendation({
      id: recorded.id,
      userId,
      decision: 'accepted',
    });
    return { workout, recommendation: decided };
  } catch (error) {
    console.error(
      `startAdaptedWorkout: workout ${workout.id} started but recommendation persistence failed`,
      error,
    );
    return { workout, recommendation: null };
  }
}
