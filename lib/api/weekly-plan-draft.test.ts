import { describe, expect, it } from '@jest/globals';

import { isWeeklyPlanDraft } from './weekly-plan-draft';

const validDraft = {
  source: 'gemini',
  name: 'Semana',
  goal: 'fuerza',
  days: [{
    dayOfWeek: 1,
    title: 'Día 1',
    focus: 'Piernas',
    exercises: [{
      exerciseId: 1,
      exerciseName: 'Sentadilla',
      muscleGroup: 'Piernas',
      sortOrder: 0,
      targetSets: 3,
      targetReps: 8,
    }],
  }],
};

describe('isWeeklyPlanDraft', () => {
  it('accepts a complete draft with valid training targets', () => {
    expect(isWeeklyPlanDraft(validDraft)).toBe(true);
  });

  it('rejects duplicate weekdays so they cannot reach review or save', () => {
    const duplicateWeekdays = {
      ...validDraft,
      days: [validDraft.days[0], { ...validDraft.days[0], title: 'Día 2' }],
    };

    expect(isWeeklyPlanDraft(duplicateWeekdays)).toBe(false);
  });

  it('rejects missing sources, empty exercises, and out-of-range targets', () => {
    expect(isWeeklyPlanDraft({ ...validDraft, source: undefined })).toBe(false);
    expect(isWeeklyPlanDraft({ ...validDraft, days: [{ ...validDraft.days[0], exercises: [] }] })).toBe(false);
    expect(isWeeklyPlanDraft({
      ...validDraft,
      days: [{
        ...validDraft.days[0],
        exercises: [{ ...validDraft.days[0].exercises[0], targetSets: 9 }],
      }],
    })).toBe(false);
  });
});
