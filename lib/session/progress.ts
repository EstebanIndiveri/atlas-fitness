export function isExerciseComplete(completedSetCount: number, targetSets: number): boolean {
  return completedSetCount >= targetSets;
}

export function completedExerciseIdsForRoutine(
  routine: { exercises: readonly { exerciseId: number; targetSets: number }[] },
  sets: readonly { exerciseId: number }[],
): number[] {
  const counts = new Map<number, number>();
  for (const set of sets) {
    counts.set(set.exerciseId, (counts.get(set.exerciseId) ?? 0) + 1);
  }

  return routine.exercises
    .filter((item) => isExerciseComplete(counts.get(item.exerciseId) ?? 0, item.targetSets))
    .map((item) => item.exerciseId);
}
