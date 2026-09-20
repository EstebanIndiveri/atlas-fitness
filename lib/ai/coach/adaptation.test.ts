import { describe, expect, it } from '@jest/globals';

import {
  adaptDeterministically,
  coachAiAdaptationResultSchema,
  coachGeminiOutputSchema,
  ESTIMATED_MINUTES_PER_SET,
} from '@/lib/ai/coach/adaptation';
import type { CoachAdaptationContext } from '@/types/coach';

function context(overrides: Partial<CoachAdaptationContext> = {}): CoachAdaptationContext {
  return {
    energy: 'low',
    mood: 2,
    freeText: 'Hoy estoy cansado',
    routine: {
      exercises: [
        { exerciseId: 10, name: 'Sentadilla', sets: 4, category: 'compound' },
        { exerciseId: 20, name: 'Press banca', sets: 3, category: 'compound' },
        { exerciseId: 30, name: 'Curl bíceps', sets: 3, category: 'accessory' },
        { exerciseId: 40, name: 'Extensión tríceps', sets: 3, category: 'accessory' },
      ],
    },
    ...overrides,
  };
}

describe('adaptDeterministically', () => {
  it('trims accessory volume on low energy while keeping compound movements', () => {
    const result = adaptDeterministically(context());

    expect(result.source).toBe('deterministic');
    expect(result.original).toEqual({ exerciseCount: 4, setCount: 13, estMinutes: 13 * ESTIMATED_MINUTES_PER_SET });
    expect(result.adapted.exerciseCount).toBeLessThan(result.original.exerciseCount);
    expect(result.adapted.setCount).toBeLessThan(result.original.setCount);
    expect(result.adapted.estMinutes).toBe(result.adapted.setCount * ESTIMATED_MINUTES_PER_SET);
    expect(result.reason).toMatch(/energía baja/i);
    expect(result.reason.trim().length).toBeGreaterThan(0);
    expect(result.exerciseDeltas).toEqual([
      { exerciseId: 10, name: 'Sentadilla', action: 'kept', fromSets: 4, toSets: 4 },
      { exerciseId: 20, name: 'Press banca', action: 'kept', fromSets: 3, toSets: 3 },
      { exerciseId: 30, name: 'Curl bíceps', action: 'reduced', fromSets: 3, toSets: 2 },
      { exerciseId: 40, name: 'Extensión tríceps', action: 'removed', fromSets: 3, toSets: 0 },
    ]);
  });

  it.each(['medium', 'high'] as const)('keeps the original routine unchanged for %s energy', (energy) => {
    const result = adaptDeterministically(context({ energy }));

    expect(result.source).toBe('deterministic');
    expect(result.adapted).toEqual(result.original);
    expect(result.reason).toMatch(/sin cambios/i);
    expect(result.exerciseDeltas.every((delta) => delta.action === 'kept')).toBe(true);
  });

  it('returns explainable deltas whose adapted set total matches the summary', () => {
    const result = adaptDeterministically(context());
    const deltaSetTotal = result.exerciseDeltas.reduce((total, delta) => total + delta.toSets, 0);
    const removedCount = result.exerciseDeltas.filter((delta) => delta.action === 'removed').length;

    expect(deltaSetTotal).toBe(result.adapted.setCount);
    expect(result.original.setCount - result.adapted.setCount).toBeGreaterThanOrEqual(3);
    expect(result.adapted.exerciseCount).toBe(result.original.exerciseCount - removedCount);
    expect(result.exerciseDeltas).toHaveLength(result.original.exerciseCount);
  });

  it('does not reduce compound movements when accessory volume is too small for the target cut', () => {
    const result = adaptDeterministically(
      context({
        routine: {
          exercises: [
            { exerciseId: 10, name: 'Sentadilla', sets: 4, category: 'compound' },
            { exerciseId: 20, name: 'Press banca', sets: 4, category: 'compound' },
            { exerciseId: 30, name: 'Plancha', sets: 1, category: 'accessory' },
          ],
        },
      }),
    );

    expect(result.exerciseDeltas).toEqual([
      { exerciseId: 10, name: 'Sentadilla', action: 'kept', fromSets: 4, toSets: 4 },
      { exerciseId: 20, name: 'Press banca', action: 'kept', fromSets: 4, toSets: 4 },
      { exerciseId: 30, name: 'Plancha', action: 'removed', fromSets: 1, toSets: 0 },
    ]);
  });

  it('rejects malformed AI structured output so callers can fall back deterministically', () => {
    const parsed = coachGeminiOutputSchema.safeParse({
      reason: '',
      suggestedChanges: [
        {
          queueItemId: '',
          kind: 'increase_sets',
          targetSets: 0,
          reason: '',
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects AI changes that omit the field required by their kind', () => {
    const parsed = coachGeminiOutputSchema.safeParse({
      reason: 'Reducimos una serie del accesorio.',
      suggestedChanges: [
        {
          queueItemId: 'exercise-1',
          kind: 'reduce_sets',
          reason: 'Energía baja.',
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects AI adaptation results missing explainability fields', () => {
    const parsed = coachAiAdaptationResultSchema.safeParse({
      reason: 'Bajamos volumen porque registraste energía baja.',
      suggestedChanges: [{ queueItemId: 'exercise-1', kind: 'remove_exercise', reason: 'Accesorio.' }],
    });

    expect(parsed.success).toBe(false);
  });
});
