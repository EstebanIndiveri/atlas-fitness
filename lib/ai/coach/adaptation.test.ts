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
    const result = adaptDeterministically(context({ energy, freeText: 'Mantener técnica' }));

    expect(result.source).toBe('deterministic');
    expect(result.adapted).toEqual(result.original);
    expect(result.reason).toMatch(/sin cambios/i);
    expect(result.exerciseDeltas.every((delta) => delta.action === 'kept')).toBe(true);
  });

  it('time-boxes medium-energy routines from free text minutes while preserving main movements', () => {
    const result = adaptDeterministically(context({ energy: 'medium', mood: 3, freeText: 'Tengo 30 minutos' }));

    expect(result.original).toEqual({ exerciseCount: 4, setCount: 13, estMinutes: 39 });
    expect(result.adapted).toEqual({ exerciseCount: 3, setCount: 10, estMinutes: 30 });
    expect(result.reason).toMatch(/30 min/i);
    expect(result.reason).toMatch(/mantenemos los movimientos principales/i);
    expect(result.reason).toMatch(/recortamos accesorios/i);
    expect(result.reason).not.toMatch(/bajamos.*principales/i);
    expect(result.exerciseDeltas).toEqual([
      { exerciseId: 10, name: 'Sentadilla', action: 'kept', fromSets: 4, toSets: 4 },
      { exerciseId: 20, name: 'Press banca', action: 'kept', fromSets: 3, toSets: 3 },
      { exerciseId: 30, name: 'Curl bíceps', action: 'kept', fromSets: 3, toSets: 3 },
      { exerciseId: 40, name: 'Extensión tríceps', action: 'removed', fromSets: 3, toSets: 0 },
    ]);
  });

  it('detects accent-insensitive fatigue and lighter requests without low energy', () => {
    const result = adaptDeterministically(context({ energy: 'high', mood: 3, freeText: 'Quiero algo más liviano, poca energía' }));

    expect(result.adapted.setCount).toBeLessThan(result.original.setCount);
    expect(result.adapted.estMinutes).toBe(result.adapted.setCount * ESTIMATED_MINUTES_PER_SET);
    expect(result.reason).toMatch(/liviano/i);
    expect(result.exerciseDeltas.some((delta) => delta.action !== 'kept')).toBe(true);
  });

  it('handles no-machine requests honestly by compacting accessory volume without claiming swaps', () => {
    const result = adaptDeterministically(context({ energy: 'medium', mood: 3, freeText: 'Hoy entreno en casa, sin máquinas disponibles' }));

    expect(result.adapted.setCount).toBeLessThan(result.original.setCount);
    expect(result.reason).toMatch(/máquinas/i);
    expect(result.reason).toMatch(/accesorios/i);
    expect(result.reason).not.toMatch(/cambiamos|reemplazamos|swap/i);
  });

  it('mentions both low energy and the time budget when both intents are present', () => {
    const result = adaptDeterministically(context({ energy: 'low', freeText: 'Tengo 30 min y estoy cansado' }));

    expect(result.adapted.estMinutes).toBeLessThanOrEqual(30);
    expect(result.reason).toMatch(/30 min/i);
    expect(result.reason).toMatch(/energía baja/i);
  });

  it('does not use a time-box reason when the requested hour already fits and lighter intent caused the reduction', () => {
    const result = adaptDeterministically(context({ energy: 'medium', freeText: 'Tengo una hora, pero quiero algo suave' }));

    expect(result.original.estMinutes).toBeLessThanOrEqual(60);
    expect(result.adapted.setCount).toBeLessThan(result.original.setCount);
    expect(result.reason).toMatch(/liviano/i);
    expect(result.reason).not.toMatch(/60 min|hora/i);
  });

  it('keeps unchanged when free text has no actionable intent', () => {
    const result = adaptDeterministically(context({ energy: 'medium', mood: 4, freeText: 'Mantener técnica y foco' }));

    expect(result.adapted).toEqual(result.original);
    expect(result.exerciseDeltas.every((delta) => delta.action === 'kept')).toBe(true);
    expect(result.reason).toMatch(/Sin cambios/i);
  });

  it('keeps an empty routine valid when free text asks for a time-box', () => {
    const result = adaptDeterministically(
      context({ energy: 'medium', freeText: '15 minutos', routine: { exercises: [] } }),
    );

    expect(result.original).toEqual({ exerciseCount: 0, setCount: 0, estMinutes: 0 });
    expect(result.adapted).toEqual(result.original);
    expect(result.exerciseDeltas).toEqual([]);
    expect(result.reason).toMatch(/Sin cambios/i);
  });

  it('reduces a single protected main movement only as far as needed for very small time budgets', () => {
    const result = adaptDeterministically(
      context({
        energy: 'medium',
        freeText: 'Tengo 10 min',
        routine: { exercises: [{ exerciseId: 10, name: 'Sentadilla', sets: 4, category: 'compound' }] },
      }),
    );

    expect(result.adapted).toEqual({ exerciseCount: 1, setCount: 3, estMinutes: 9 });
    expect(result.reason).toMatch(/bajamos series de los movimientos principales/i);
    expect(result.reason).not.toMatch(/accesorios/i);
    expect(result.exerciseDeltas).toEqual([
      { exerciseId: 10, name: 'Sentadilla', action: 'reduced', fromSets: 4, toSets: 3 },
    ]);
  });

  it('ignores unparseable time text without another adaptation intent', () => {
    const result = adaptDeterministically(context({ energy: 'medium', mood: 3, freeText: 'Entreno un ratito' }));

    expect(result.adapted).toEqual(result.original);
    expect(result.reason).toMatch(/Sin cambios/i);
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
