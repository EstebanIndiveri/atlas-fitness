import { compareDecimal, normalizeDecimal } from '@/lib/format/decimal';
import type { ExerciseImprovement, ImprovementDirection } from '@/types/routine';

export interface WeightSetLike {
  weightKg: string;
}

function maxWeightKg(sets: readonly WeightSetLike[]): string | null {
  let max: string | null = null;
  for (const set of sets) {
    if (max === null || compareDecimal(set.weightKg, max) > 0) {
      max = set.weightKg;
    }
  }
  return max;
}

function signedDeltaKg(current: string, previous: string): string {
  const delta = currentValueMinus(current, previous);
  return normalizeDecimal(delta);
}

function currentValueMinus(current: string, previous: string): string {
  return (Number.parseFloat(current) - Number.parseFloat(previous)).toString();
}

export function compareMaxWeight(
  currentSets: readonly WeightSetLike[],
  previousSets: readonly WeightSetLike[] | null,
): Pick<ExerciseImprovement, 'currentMaxKg' | 'previousMaxKg' | 'deltaKg' | 'direction'> {
  const currentMaxKg = maxWeightKg(currentSets) ?? '0';
  if (!previousSets || previousSets.length === 0) {
    return {
      currentMaxKg,
      previousMaxKg: null,
      deltaKg: null,
      direction: 'none',
    };
  }

  const previousMaxKg = maxWeightKg(previousSets);
  if (previousMaxKg === null) {
    return {
      currentMaxKg,
      previousMaxKg: null,
      deltaKg: null,
      direction: 'none',
    };
  }

  const comparison = compareDecimal(currentMaxKg, previousMaxKg);
  let direction: ImprovementDirection = 'same';
  if (comparison > 0) direction = 'up';
  if (comparison < 0) direction = 'down';

  const raw = signedDeltaKg(currentMaxKg, previousMaxKg);
  const deltaKg = raw.startsWith('-') ? raw.slice(1) : raw;

  return {
    currentMaxKg,
    previousMaxKg,
    deltaKg,
    direction,
  };
}
