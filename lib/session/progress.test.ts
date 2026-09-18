import { describe, expect, it } from '@jest/globals';
import { completedExerciseIdsForRoutine, isExerciseComplete } from './progress';

describe('session progress', () => {
  it('requires target sets to mark an exercise complete', () => {
    expect(isExerciseComplete(2, 3)).toBe(false);
    expect(isExerciseComplete(3, 3)).toBe(true);
  });

  it('uses routine targets rather than raw set presence', () => {
    const routine = {
      exercises: [
        { exerciseId: 1, targetSets: 2 },
        { exerciseId: 2, targetSets: 1 },
      ],
    };
    expect(completedExerciseIdsForRoutine(routine, [{ exerciseId: 1 }])).toEqual([]);
    expect(
      completedExerciseIdsForRoutine(routine, [{ exerciseId: 1 }, { exerciseId: 1 }]),
    ).toEqual([1]);
  });
});
