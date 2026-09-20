/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import { generateCoachAdaptation } from '@/lib/ai/coach/gemini-adaptation';
import { ESTIMATED_MINUTES_PER_SET } from '@/lib/ai/coach/adaptation';
import type { CoachAdaptationContext } from '@/types/coach';

function context(overrides: Partial<CoachAdaptationContext> = {}): CoachAdaptationContext {
  return {
    energy: 'low',
    mood: 2,
    freeText: 'Dormí poco',
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

describe('generateCoachAdaptation', () => {
  it('returns source ai for schema-valid model output that preserves invariants', async () => {
    const result = await generateCoachAdaptation(context(), {
      generateContent: async () =>
        JSON.stringify({
          reason:
            'Bajamos accesorios porque registraste energía baja, manteniendo los movimientos principales.',
          suggestedChanges: [
            {
              kind: 'keep_exercise',
              queueItemId: '10',
              reason: 'Sentadilla se mantiene como movimiento principal.',
            },
            {
              kind: 'keep_exercise',
              queueItemId: '20',
              reason: 'Press banca se mantiene como movimiento principal.',
            },
            {
              kind: 'reduce_sets',
              queueItemId: '30',
              targetSets: 2,
              reason: 'Reducimos una serie del accesorio.',
            },
            {
              kind: 'remove_exercise',
              queueItemId: '40',
              reason: 'Quitamos el accesorio final para cuidar energía.',
            },
          ],
        }),
    });

    expect(result.source).toBe('ai');
    expect(result.reason).toMatch(/energía baja/i);
    expect(result.original).toEqual({ exerciseCount: 4, setCount: 13, estMinutes: 39 });
    expect(result.adapted).toEqual({ exerciseCount: 3, setCount: 9, estMinutes: 27 });
    expect(result.exerciseDeltas).toEqual([
      { exerciseId: 10, name: 'Sentadilla', action: 'kept', fromSets: 4, toSets: 4 },
      { exerciseId: 20, name: 'Press banca', action: 'kept', fromSets: 3, toSets: 3 },
      { exerciseId: 30, name: 'Curl bíceps', action: 'reduced', fromSets: 3, toSets: 2 },
      { exerciseId: 40, name: 'Extensión tríceps', action: 'removed', fromSets: 3, toSets: 0 },
    ]);
  });

  it('falls back deterministically without throwing when model output is not JSON', async () => {
    const result = await generateCoachAdaptation(context(), {
      generateContent: async () => 'No puedo devolver JSON ahora.',
    });

    expect(result.source).toBe('deterministic');
    expect(result.reason).toMatch(/energía baja/i);
  });

  it('rejects schema-valid output that references an exercise outside the context', async () => {
    const result = await generateCoachAdaptation(context(), {
      generateContent: async () =>
        JSON.stringify({
          reason: 'Recortamos un accesorio por energía baja.',
          suggestedChanges: [
            {
              kind: 'remove_exercise',
              queueItemId: '999',
              reason: 'Este ejercicio no existe en la rutina enviada.',
            },
          ],
        }),
    });

    expect(result.source).toBe('deterministic');
    expect(result.exerciseDeltas.map((delta) => delta.exerciseId)).toEqual([10, 20, 30, 40]);
  });

  it('rejects schema-valid changes that the result delta cannot represent', async () => {
    const result = await generateCoachAdaptation(context(), {
      generateContent: async () =>
        JSON.stringify({
          reason: 'Reducimos repeticiones de un accesorio por energía baja.',
          suggestedChanges: [
            {
              kind: 'reduce_reps',
              queueItemId: '30',
              targetReps: 8,
              reason: 'Este cambio no se puede reflejar en deltas por serie.',
            },
          ],
        }),
    });

    expect(result.source).toBe('deterministic');
    expect(result.exerciseDeltas.find((delta) => delta.exerciseId === 30)).toEqual({
      exerciseId: 30,
      name: 'Curl bíceps',
      action: 'reduced',
      fromSets: 3,
      toSets: 2,
    });
  });

  it('falls back deterministically when the Gemini client rejects', async () => {
    const result = await generateCoachAdaptation(context(), {
      generateContent: async () => {
        throw new Error('Gemini unavailable');
      },
    });

    expect(result.source).toBe('deterministic');
    expect(result.adapted.setCount).toBeLessThan(result.original.setCount);
  });

  it('keeps deterministic fallback explainable with deltas matching the adapted summary', async () => {
    const result = await generateCoachAdaptation(context(), {
      generateContent: async () => '{ "reason": "" }',
    });
    const adaptedSetTotal = result.exerciseDeltas.reduce((total, delta) => total + delta.toSets, 0);
    const removedCount = result.exerciseDeltas.filter((delta) => delta.action === 'removed').length;

    expect(result.source).toBe('deterministic');
    expect(adaptedSetTotal).toBe(result.adapted.setCount);
    expect(result.adapted.estMinutes).toBe(result.adapted.setCount * ESTIMATED_MINUTES_PER_SET);
    expect(result.adapted.exerciseCount).toBe(result.original.exerciseCount - removedCount);
    expect(result.reason.trim().length).toBeGreaterThan(0);
  });
});
