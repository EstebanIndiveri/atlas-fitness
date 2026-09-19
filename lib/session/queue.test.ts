import { describe, expect, it } from '@jest/globals';
import {
  applyHold,
  applySessionQueueAction,
  applySkip,
  buildWorkoutQueue,
  reconcileWorkoutQueue,
  selectQueuedExercise,
} from './queue';
import type { WorkoutQueueSetSnapshot } from '@/types/session-queue';

const ORDERED = [10, 20, 30] as const;

function setSnapshot(exerciseId: number, weightKg: string): WorkoutQueueSetSnapshot {
  return {
    id: exerciseId * 10,
    exerciseId,
    setIndex: 1,
    reps: 8,
    weightKg,
  };
}

describe('buildWorkoutQueue', () => {
  it('starts as routine order minus completed target-sets', () => {
    expect(buildWorkoutQueue({ orderedExerciseIds: ORDERED, completedExerciseIds: [10] })).toEqual({
      pendingExerciseIds: [20, 30],
      skippedExerciseIds: [],
      heldExerciseIds: [],
    });
  });
});

describe('applySkip', () => {
  it('advances past the current exercise without putting it back', () => {
    const queue = buildWorkoutQueue({ orderedExerciseIds: ORDERED, completedExerciseIds: [] });
    const skipped = applySkip(queue, 10);
    expect(skipped.pendingExerciseIds).toEqual([20, 30]);
    expect(skipped.skippedExerciseIds).toEqual([10]);
    expect(selectQueuedExercise(ORDERED.map((exerciseId) => ({ exerciseId })), skipped)?.exerciseId).toBe(
      20,
    );
  });
});

describe('applyHold', () => {
  it('defers the current exercise so it reappears after the others', () => {
    const items = ORDERED.map((exerciseId) => ({ exerciseId }));
    const start = buildWorkoutQueue({ orderedExerciseIds: ORDERED, completedExerciseIds: [] });
    const held = applyHold(start, 10);
    expect(held.pendingExerciseIds).toEqual([20, 30, 10]);
    expect(held.heldExerciseIds).toEqual([10]);
    expect(selectQueuedExercise(items, held)?.exerciseId).toBe(20);

    const afterSecond = applySkip(held, 20);
    expect(selectQueuedExercise(items, afterSecond)?.exerciseId).toBe(30);

    const afterThird = applySkip(afterSecond, 30);
    expect(afterThird.pendingExerciseIds).toEqual([10]);
    expect(selectQueuedExercise(items, afterThird)?.exerciseId).toBe(10);
  });
});

describe('applySessionQueueAction', () => {
  it('does not mutate finished set snapshots (same reference and decimal weight)', () => {
    const sets = [setSnapshot(10, '40.5'), setSnapshot(10, '42.5')];
    const snapshot = {
      queue: buildWorkoutQueue({ orderedExerciseIds: ORDERED, completedExerciseIds: [] }),
      sets,
    };

    const skipped = applySessionQueueAction(snapshot, 'skip', 10);
    expect(skipped.sets).toBe(sets);
    expect(skipped.sets).toEqual([
      expect.objectContaining({ weightKg: '40.5' }),
      expect.objectContaining({ weightKg: '42.5' }),
    ]);

    const held = applySessionQueueAction(snapshot, 'hold', 10);
    expect(held.sets).toBe(sets);
    expect(held.sets.map((set) => set.weightKg)).toEqual(['40.5', '42.5']);
  });
});

describe('reconcileWorkoutQueue', () => {
  it('keeps skip/hold order across a reload without an API queue', () => {
    const previous = applyHold(
      buildWorkoutQueue({ orderedExerciseIds: ORDERED, completedExerciseIds: [] }),
      10,
    );
    const reconciled = reconcileWorkoutQueue({
      orderedExerciseIds: ORDERED,
      completedExerciseIds: [],
      previous,
    });
    expect(reconciled.pendingExerciseIds).toEqual([20, 30, 10]);
    expect(reconciled.heldExerciseIds).toEqual([10]);
  });

  it('prefers the API queue when present', () => {
    const fromApi = {
      pendingExerciseIds: [30, 10],
      skippedExerciseIds: [20],
      heldExerciseIds: [10],
    };
    const reconciled = reconcileWorkoutQueue({
      orderedExerciseIds: ORDERED,
      completedExerciseIds: [],
      previous: null,
      fromApi,
    });
    expect(reconciled).toEqual(fromApi);
    expect(reconciled).not.toBe(fromApi);
  });
});
