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
  targetSetsOverrides?: Record<number, number>;
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
    ...(args.targetSetsOverrides
      ? { targetSetsOverrides: { ...args.targetSetsOverrides } }
      : {}),
  };
}

/**
 * After a reload, restore skip/hold order. The local override (freshest action
 * result) takes precedence; the persisted API queue only seeds the base when
 * there is no local override yet (first load / reload).
 */
export function reconcileWorkoutQueue(args: {
  orderedExerciseIds: readonly number[];
  completedExerciseIds: Iterable<number>;
  previous: WorkoutQueueState | null;
  fromApi?: WorkoutQueueState | null;
}): WorkoutQueueState {
  const base = args.previous ?? args.fromApi ?? null;

  const completed = new Set(args.completedExerciseIds);
  const skipped = (base?.skippedExerciseIds ?? []).filter((id) => !completed.has(id));
  const skippedSet = new Set(skipped);
  const remaining = args.orderedExerciseIds.filter(
    (id) => !completed.has(id) && !skippedSet.has(id),
  );
  const previousPending = base?.pendingExerciseIds ?? [];
  const pending = [
    ...previousPending.filter((id) => remaining.includes(id)),
    ...remaining.filter((id) => !previousPending.includes(id)),
  ];
  const held = (base?.heldExerciseIds ?? []).filter((id) => pending.includes(id));

  return {
    pendingExerciseIds: pending,
    skippedExerciseIds: skipped,
    heldExerciseIds: held,
    ...(base?.targetSetsOverrides
      ? { targetSetsOverrides: { ...base.targetSetsOverrides } }
      : {}),
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
    ...copyTargetSetsOverrides(queue),
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
    ...copyTargetSetsOverrides(queue),
  };
}

export function applyComplete(queue: WorkoutQueueState, exerciseId: number): WorkoutQueueState {
  return {
    pendingExerciseIds: queue.pendingExerciseIds.filter((id) => id !== exerciseId),
    skippedExerciseIds: [...queue.skippedExerciseIds],
    heldExerciseIds: queue.heldExerciseIds.filter((id) => id !== exerciseId),
    ...copyTargetSetsOverrides(queue),
  };
}

export function applyTargetSetsOverrides<T extends { exerciseId: number; targetSets: number }>(
  exercises: readonly T[],
  overrides?: Readonly<Record<number, number>>,
): T[] {
  if (!overrides) {
    return [...exercises];
  }

  return exercises.map((exercise) => {
    const targetSets = overrides[exercise.exerciseId];
    return targetSets === undefined ? exercise : { ...exercise, targetSets };
  });
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
  const queue =
    action === 'skip' ? applySkip(snapshot.queue, exerciseId) : applyHold(snapshot.queue, exerciseId);
  return { queue, sets: snapshot.sets };
}

export function parseStoredQueue(value: unknown): WorkoutQueueState | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const pending = asIntArray(record.pendingExerciseIds);
  const skipped = asIntArray(record.skippedExerciseIds);
  const held = asIntArray(record.heldExerciseIds);
  if (!pending || !skipped || !held) {
    return null;
  }
  const targetSetsOverrides = hasTargetSetsOverrides(record)
    ? parseTargetSetsOverrides(record.targetSetsOverrides)
    : undefined;
  if (hasTargetSetsOverrides(record) && !targetSetsOverrides) {
    return null;
  }
  return {
    pendingExerciseIds: pending,
    skippedExerciseIds: skipped,
    heldExerciseIds: held,
    ...(targetSetsOverrides ? { targetSetsOverrides } : {}),
  };
}

export function parseStoredQueueJson(raw: string | null | undefined): WorkoutQueueState | null {
  if (!raw) {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  const parsed = parseStoredQueue(value);
  if (parsed) {
    return parsed;
  }

  if (
    isRecord(value) &&
    hasTargetSetsOverrides(value) &&
    asIntArray(value.pendingExerciseIds) &&
    asIntArray(value.skippedExerciseIds) &&
    asIntArray(value.heldExerciseIds) &&
    !parseTargetSetsOverrides(value.targetSetsOverrides)
  ) {
    throw new Error('Invalid target set overrides in persisted workout queue');
  }
  return null;
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
    ...copyTargetSetsOverrides(queue),
  };
}

function copyTargetSetsOverrides(
  queue: WorkoutQueueState,
): { targetSetsOverrides?: Record<number, number> } {
  return queue.targetSetsOverrides
    ? { targetSetsOverrides: { ...queue.targetSetsOverrides } }
    : {};
}

function hasTargetSetsOverrides(record: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(record, 'targetSetsOverrides');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTargetSetsOverrides(value: unknown): Record<number, number> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const overrides: Record<number, number> = {};
  for (const [rawExerciseId, targetSets] of Object.entries(value)) {
    const exerciseId = Number(rawExerciseId);
    if (
      !Number.isSafeInteger(exerciseId) ||
      exerciseId <= 0 ||
      typeof targetSets !== 'number' ||
      !Number.isInteger(targetSets) ||
      targetSets <= 0
    ) {
      return null;
    }
    overrides[exerciseId] = targetSets;
  }
  return overrides;
}

function asIntArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  if (!value.every((item) => typeof item === 'number' && Number.isInteger(item))) {
    return null;
  }
  return value;
}
