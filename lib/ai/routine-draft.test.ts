import { describe, expect, it, jest } from '@jest/globals';

import { generateRoutineDraft } from './routine-draft';
import type { ExerciseCatalogItem } from '@/types/exercise';

const catalog: ExerciseCatalogItem[] = [
  { id: 1, slug: 'sentadilla', name: 'Sentadilla', muscleGroup: 'Piernas', instructions: 'Bajá controlado.', imageUrl: null, videoUrl: null, isSystem: true },
  { id: 2, slug: 'press-banca', name: 'Press de banca', muscleGroup: 'Pecho', instructions: 'Empujá firme.', imageUrl: null, videoUrl: null, isSystem: true },
  { id: 3, slug: 'remo', name: 'Remo con mancuerna', muscleGroup: 'Espalda', instructions: 'Llevá el codo atrás.', imageUrl: null, videoUrl: null, isSystem: true },
  { id: 4, slug: 'plancha', name: 'Plancha frontal', muscleGroup: 'Core', instructions: 'Mantené la postura.', imageUrl: null, videoUrl: null, isSystem: true },
];

const brief = {
  goal: 'ganar fuerza sin perder técnica',
  daysPerWeek: 3,
  location: 'gym' as const,
  level: 'intermediate' as const,
};

describe('generateRoutineDraft', () => {
  it('builds a deterministic fallback draft from the real catalog when Gemini is disabled', async () => {
    const first = await generateRoutineDraft(brief, catalog, { env: { GEMINI_API_KEY: '' } });
    const second = await generateRoutineDraft(brief, catalog, { env: { GEMINI_API_KEY: '' } });

    expect(first).toEqual(second);
    expect(first.source).toBe('fallback');
    expect(first.name).toContain('Coach Atlas');
    expect(first.kind).toBe('gym');
    expect(first.restSeconds).toBe(120);
    expect(first.exercises).toHaveLength(4);
    expect(first.exercises.map((exercise) => exercise.exerciseId)).toEqual([1, 2, 3, 4]);
    expect(first.exercises.every((exercise) => exercise.targetSets > 0 && exercise.targetReps > 0)).toBe(true);
  });

  it('returns a useful minimal fallback draft when the brief is short', async () => {
    const draft = await generateRoutineDraft(
      { goal: 'salud', daysPerWeek: 1, location: 'home', level: 'beginner' },
      catalog.slice(0, 2),
      { env: { GEMINI_API_KEY: '' } },
    );

    expect(draft.kind).toBe('home');
    expect(draft.restSeconds).toBe(75);
    expect(draft.exercises.map((exercise) => exercise.exerciseId)).toEqual([1, 2]);
    expect(draft.exercises.map((exercise) => exercise.sortOrder)).toEqual([0, 1]);
  });

  it('drops invented Gemini exercises and fills the draft with catalog exercises only', async () => {
    const fetchImpl = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    name: 'Rutina inventada',
                    description: 'Debe limpiar ids externos.',
                    kind: 'gym',
                    restSeconds: 90,
                    exercises: [
                      { exerciseId: 999, sortOrder: 0, targetSets: 5, targetReps: 5 },
                      { exerciseId: 3, sortOrder: 1, targetSets: 3, targetReps: 10 },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    } as Response);

    const draft = await generateRoutineDraft(brief, catalog, {
      env: { GEMINI_API_KEY: 'test-key' },
      fetchImpl,
    });

    expect(draft.source).toBe('gemini');
    expect(draft.exercises.map((exercise) => exercise.exerciseId)).toEqual([3, 1, 2, 4]);
    expect(draft.exercises.every((exercise) => catalog.some((item) => item.id === exercise.exerciseId))).toBe(true);
    expect(draft.exercises.map((exercise) => exercise.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it('keeps the user-selected location even when Gemini returns a different kind', async () => {
    const fetchImpl = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    name: 'Casa simple',
                    description: 'No debe cambiar a gimnasio.',
                    kind: 'gym',
                    restSeconds: 90,
                    exercises: [{ exerciseId: 1, sortOrder: 0, targetSets: 2, targetReps: 12 }],
                  }),
                },
              ],
            },
          },
        ],
      }),
    } as Response);

    const draft = await generateRoutineDraft(
      { goal: 'moverme en casa', daysPerWeek: 2, location: 'home', level: 'beginner' },
      catalog,
      { env: { GEMINI_API_KEY: 'test-key' }, fetchImpl },
    );

    expect(draft.kind).toBe('home');
  });

});
