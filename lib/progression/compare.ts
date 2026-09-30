import type { EligibleSet, ProgressionComparison, WorkoutRepresentative } from '@/types/progression';
import { compareExactDecimal } from './decimal';

function isEarlierSource(candidate: EligibleSet, incumbent: EligibleSet): boolean {
  const a = candidate.observation;
  const b = incumbent.observation;
  if (a.setIndex !== b.setIndex) {
    return a.setIndex < b.setIndex;
  }
  return a.setId < b.setId;
}

/**
 * Selects the representative set of one workout within one cohort: the highest
 * exact decimal amount, ties broken by the lowest `(setIndex, setId)`. All input
 * sets must belong to the same workout and cohort. Returns `null` when empty.
 */
export function selectWorkoutRepresentative(
  sets: readonly EligibleSet[],
): WorkoutRepresentative | null {
  let best: EligibleSet | null = null;

  for (const candidate of sets) {
    if (candidate.observation.workoutEndedAt === null) {
      continue;
    }
    if (best === null) {
      best = candidate;
      continue;
    }
    const comparison = compareExactDecimal(
      candidate.observation.weightKg,
      best.observation.weightKg,
    );
    if (comparison > 0) {
      best = candidate;
    } else if (comparison === 0 && isEarlierSource(candidate, best)) {
      best = candidate;
    }
  }

  if (best === null) {
    return null;
  }

  const endedAt = best.observation.workoutEndedAt;
  if (endedAt === null) {
    return null;
  }

  const { observation, cohort } = best;
  return {
    workoutId: observation.workoutId,
    setId: observation.setId,
    setIndex: observation.setIndex,
    reps: observation.reps,
    weightKg: observation.weightKg,
    cohort,
    endedAt,
  };
}

/**
 * Classifies a workout representative against the best earlier eligible workout.
 * The first observation is always a `baseline`, never a PR; equality is a tie.
 */
export function compareToPriorBest(
  currentWeightKg: string,
  priorBestWeightKg: string | null,
): ProgressionComparison {
  if (priorBestWeightKg === null) {
    return 'baseline';
  }
  const comparison = compareExactDecimal(currentWeightKg, priorBestWeightKg);
  if (comparison > 0) {
    return 'new_pr';
  }
  if (comparison === 0) {
    return 'ties_best';
  }
  return 'below_best';
}
