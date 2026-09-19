import type { WorkoutQueueSetSnapshot, WorkoutQueueState } from '@/types/session-queue';

export function emptyWorkoutQueue(): WorkoutQueueState {
  return {
    pendingExerciseIds: [],
    skippedExerciseIds: [],
    heldExerciseIds: [],
  };
}

export function buildWorkoutQueue(args: {
  orderedExerciseIds: readonly number[];
  completedExerciseIds: Iterable<number>;
  skippedExerciseIds?: Iterable<number>;
  heldExerciseIds?: Iterable<number>;
}): WorkoutQueueState {
  const completed = new Set(args.completedExerciseIds);
  const skipped = uniqueNumbers(args.skippedExerciseIds ?? []).filter((id) => !completed.has(id));
  const skippedSet = new Set(skipped);
  const pending = args.orderedExerciseIds.filter((id) => !completed.has(id) && !skippedSet.has(id));
  const held = uniqueNumbers(args.heldExerciseIds ?? []).filter((id) => pending.includes(id));
  return {
    pendingExerciseIds: applyHeldOrder(pending, held),
    skippedExerciseIds: skipped,
    heldExerciseIds: held,
  };
}

/**
 * After a reload, keep skip/hold order unless the API already persisted `queue`.
 */
export function reconcileWorkoutQueue(args: {
  orderedExerciseIds: readonly number[];
  completedExerciseIds: Iterable<number>;
  previous: WorkoutQueueState | null;
  fromApi?: WorkoutQueueState | null;
}): WorkoutQueueState {
  if (args.fromApi) {
    return cloneQueue(args.fromApi);
  }

  const completed = new Set(args.completedExerciseIds);
  const skipped = (args.previous?.skippedExerciseIds ?? []).filter((id) => !completed.has(id));
  const skippedSet = new Set(skipped);
  const remaining = args.orderedExerciseIds.filter(
    (id) => !completed.has(id) && !skippedSet.has(id),
  );
  const previousPending = args.previous?.pendingExerciseIds ?? [];
  const pending = [
    ...previousPending.filter((id) => remaining.includes(id)),
    ...remaining.filter((id) => !previousPending.includes(id)),
  ];
  const held = (args.previous?.heldExerciseIds ?? []).filter((id) => pending.includes(id));

  return {
    pendingExerciseIds: pending,
    skippedExerciseIds: skipped,
    heldExerciseIds: held,
  };
}

export function applySkip(queue: WorkoutQueueState, exerciseId: number): WorkoutQueueState {
  if (!queue.pendingExerciseIds.includes(exerciseId)) {
    return cloneQueue(queue);
  }

  return {
    pendingExerciseIds: queue.pendingExerciseIds.filter((id) => id !== exerciseId),
    skippedExerciseIds: uniqueNumbers([...queue.skippedExerciseIds, exerciseId]),
    heldExerciseIds: queue.heldExerciseIds.filter((id) => id !== exerciseId),
  };
}

export function applyHold(queue: WorkoutQueueState, exerciseId: number): WorkoutQueueState {
  if (!queue.pendingExerciseIds.includes(exerciseId)) {
    return cloneQueue(queue);
  }

  const without = queue.pendingExerciseIds.filter((id) => id !== exerciseId);
  return {
    pendingExerciseIds: [...without, exerciseId],
    skippedExerciseIds: [...queue.skippedExerciseIds],
    heldExerciseIds: uniqueNumbers([...queue.heldExerciseIds, exerciseId]),
  };
}

export function applyComplete(queue: WorkoutQueueState, exerciseId: number): WorkoutQueueState {
  return {
    pendingExerciseIds: queue.pendingExerciseIds.filter((id) => id !== exerciseId),
    skippedExerciseIds: [...queue.skippedExerciseIds],
    heldExerciseIds: queue.heldExerciseIds.filter((id) => id !== exerciseId),
  };
}

export function queueItemsFromRoutine(
  exercises: readonly { exerciseId: number; exerciseName: string }[],
  queue: WorkoutQueueState,
  currentExerciseId: number | null,
): { exerciseId: number; name: string; current: boolean; held: boolean }[] {
  const held = new Set(queue.heldExerciseIds);
  return queue.pendingExerciseIds.flatMap((exerciseId) => {
    const item = exercises.find((exercise) => exercise.exerciseId === exerciseId);
    if (!item) {
      return [];
    }
    return [
      {
        exerciseId,
        name: item.exerciseName,
        current: currentExerciseId === exerciseId,
        held: held.has(exerciseId),
      },
    ];
  });
}

export function selectQueuedExercise<T extends { exerciseId: number }>(
  ordered: readonly T[],
  queue: WorkoutQueueState,
  preferredId: number | null = null,
): T | null {
  const pending = queue.pendingExerciseIds
    .map((id) => ordered.find((item) => item.exerciseId === id))
    .filter((item): item is T => Boolean(item));

  if (pending.length === 0) {
    return null;
  }

  if (preferredId !== null) {
    const preferred = pending.find((item) => item.exerciseId === preferredId);
    if (preferred) {
      return preferred;
    }
  }

  return pending[0];
}

export type SessionQueueSnapshot = {
  queue: WorkoutQueueState;
  sets: readonly WorkoutQueueSetSnapshot[];
};

/**
 * Domain apply: queue changes, set snapshots stay the same reference.
 */
export function applySessionQueueAction(
  snapshot: SessionQueueSnapshot,
  action: 'skip' | 'hold',
  exerciseId: number,
): SessionQueueSnapshot {
  const queue = action === 'skip' ? applySkip(snapshot.queue, exerciseId) : applyHold(snapshot.queue, exerciseId);
  return { queue, sets: snapshot.sets };
}

function applyHeldOrder(pending: number[], held: number[]): number[] {
  if (held.length === 0) {
    return pending;
  }
  const heldSet = new Set(held);
  const front = pending.filter((id) => !heldSet.has(id));
  const back = held.filter((id) => pending.includes(id));
  return [...front, ...back];
}

function uniqueNumbers(values: Iterable<number>): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

function cloneQueue(queue: WorkoutQueueState): WorkoutQueueState {
  return {
    pendingExerciseIds: [...queue.pendingExerciseIds],
    skippedExerciseIds: [...queue.skippedExerciseIds],
    heldExerciseIds: [...queue.heldExerciseIds],
  };
}
