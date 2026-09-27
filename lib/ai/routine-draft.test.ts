import { describe, expect, it, jest } from '@jest/globals';

import { buildRoutineDraft, generateRoutineDraft } from './routine-draft';
import type { RoutineDraftCatalogItem, RoutineDraftContext } from './routine-draft';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requestPrompt(body: unknown): string {
  if (typeof body !== 'string') return '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return '';
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.contents)) return '';
  const first = parsed.contents[0];
  if (!isRecord(first) || !Array.isArray(first.parts)) return '';
  const part = first.parts[0];
  return isRecord(part) && typeof part.text === 'string' ? part.text : '';
}

describe('generateRoutineDraft', () => {
  it('builds a deterministic fallback draft from the real catalog when Gemini is disabled', async () => {
    const first = await generateRoutineDraft(brief, catalog, { env: { GEMINI_API_KEY: '' } });
    const second = await generateRoutineDraft(brief, catalog, { env: { GEMINI_API_KEY: '' } });

    expect(first).toEqual(second);
    expect(first.source).toBe('fallback');
    expect(first.name).toContain('Coach Atlas');
    expect(first.name).not.toMatch(/Borrador/i);
    expect(first.description).toBe('Sesión de gimnasio de 60 minutos con ejercicios reales del catálogo.');
    expect(first.description).not.toMatch(/Borrador/i);
    expect(first.kind).toBe('gym');
    expect(first.restSeconds).toBe(120);
    expect(first.reason).toBe('Atlas seleccionó 4 ejercicios del catálogo para ganar fuerza sin perder técnica, con volumen intermedio.');
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

  it('preserves the legacy exercise shape for the unchanged weekly-plan consumer', async () => {
    const draft = await generateRoutineDraft(
      { goal: 'salud', daysPerWeek: 1, location: 'home', level: 'beginner' },
      catalog.slice(0, 2),
      { env: { GEMINI_API_KEY: '' } },
    );

    expect(draft.exercises[0]).not.toHaveProperty('instructions');
    expect(draft.exercises[0]).not.toHaveProperty('imageUrl');
    expect(draft.exercises[0]).not.toHaveProperty('videoUrl');
  });

  it('repairs invented Gemini ids using only exercises from the eligible catalog', async () => {
    const fetchImpl = jest.fn<typeof fetch>()
      .mockResolvedValueOnce({
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
                    reason: 'El remo inicia el plan y el resto completa grupos musculares reales.',
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
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      name: 'Fuerza validada',
                      description: 'Movimientos del catálogo.',
                      reason: 'Todos los ejercicios pertenecen al catálogo disponible.',
                      kind: 'gym',
                      restSeconds: 90,
                      exercises: [
                        { exerciseId: 3, sortOrder: 0, targetSets: 2, targetReps: 10 },
                        { exerciseId: 1, sortOrder: 1, targetSets: 2, targetReps: 10 },
                        { exerciseId: 2, sortOrder: 2, targetSets: 2, targetReps: 10 },
                        { exerciseId: 4, sortOrder: 3, targetSets: 2, targetReps: 10 },
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
    expect(draft.reason).toBe('Todos los ejercicios pertenecen al catálogo disponible.');
    expect(draft.exercises.map((exercise) => exercise.exerciseId)).toEqual([3, 1, 2, 4]);
    expect(draft.exercises.every((exercise) => catalog.some((item) => item.id === exercise.exerciseId))).toBe(true);
    expect(draft.exercises.map((exercise) => exercise.sortOrder)).toEqual([0, 1, 2, 3]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
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

  it('falls back from Gemini text fields that would fail routine creation', async () => {
    const fetchImpl = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    name: 'A\u0000',
                    description: ' \u0000 ',
                    reason: '  Usa\nmovimientos reales\u0000 del catálogo.  ',
                    kind: 'gym',
                    restSeconds: 90,
                    exercises: [
                      { exerciseId: 1, sortOrder: 0, targetSets: 3, targetReps: 8 },
                      { exerciseId: 2, sortOrder: 1, targetSets: 3, targetReps: 8 },
                      { exerciseId: 3, sortOrder: 2, targetSets: 3, targetReps: 8 },
                      { exerciseId: 4, sortOrder: 3, targetSets: 3, targetReps: 8 },
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

    expect(draft.name).toBe('Coach Atlas · ganar fuerza sin perder técnica');
    expect(draft.name.length).toBeGreaterThanOrEqual(2);
    expect(draft.description).toBe('Sesión de gimnasio de 60 minutos con ejercicios reales del catálogo.');
    expect(draft.reason).toBe('Usa movimientos reales del catálogo.');
  });
  it('keeps an exclusive legs focus in the deterministic fallback', async () => {
    const draft = await generateRoutineDraft(
      { ...brief, focusAreas: ['piernas'] },
      catalog,
      { env: { GEMINI_API_KEY: '' } },
    );

    expect(draft.exercises).toHaveLength(1);
    expect(draft.exercises.map((exercise) => exercise.exerciseId)).toEqual([1]);
    expect(draft.exercises.every((exercise) => exercise.muscleGroup.toLowerCase() === 'piernas')).toBe(true);
  });

  it('rejects Gemini exercises outside an exclusive legs focus', async () => {
    const fetchImpl = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    name: 'Piernas',
                    description: 'Solo movimientos de piernas.',
                    reason: 'Foco exclusivo en piernas.',
                    kind: 'gym',
                    restSeconds: 90,
                    exercises: [
                      { exerciseId: 2, sortOrder: 0, targetSets: 3, targetReps: 10 },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    } as Response);

    const draft = await generateRoutineDraft(
      { ...brief, focusAreas: ['piernas'] },
      catalog,
      { env: { GEMINI_API_KEY: 'test-key' }, fetchImpl },
    );

    expect(draft.exercises).toHaveLength(1);
    expect(draft.exercises.map((exercise) => exercise.exerciseId)).toEqual([1]);
    expect(draft.exercises.every((exercise) => exercise.muscleGroup.toLowerCase() === 'piernas')).toBe(true);
    const firstPrompt = requestPrompt(fetchImpl.mock.calls[0]?.[1]?.body);
    const repairPrompt = requestPrompt(fetchImpl.mock.calls[1]?.[1]?.body);
    expect(firstPrompt).toContain('Catálogo elegible: [{"id":1');
    expect(firstPrompt).not.toContain('"id":2');
    expect(repairPrompt).toContain('Catálogo elegible: [{"id":1');
    expect(repairPrompt).not.toContain('"id":2');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('builds one session from an explicit goal, focus, duration, and authenticated catalog', async () => {
    const context: RoutineDraftContext = {
      goal: 'ganar fuerza',
      focusAreas: ['piernas'],
      location: 'gym',
      level: 'beginner',
      sessionLengthMinutes: 45,
      catalog,
    };

    const draft = await buildRoutineDraft(context, { env: { GEMINI_API_KEY: '' } });

    expect(draft.description).toContain('45 minutos');
    expect(draft.description).not.toContain('día');
    expect(draft.exercises.map(({ exerciseId }) => exerciseId)).toEqual([1]);
    expect(draft.exercises[0]).toMatchObject({
      instructions: 'Bajá controlado.',
      imageUrl: null,
      videoUrl: null,
    });
  });

  it('excludes exercises with unknown equipment when equipment availability is explicit', async () => {
    const equipmentCatalog: RoutineDraftCatalogItem[] = [
      { ...catalog[0], equipment: [] },
      { ...catalog[1], equipment: ['mancuernas'] },
      catalog[2],
    ];

    const draft = await buildRoutineDraft({
      goal: 'fuerza',
      focusAreas: [],
      location: 'home',
      availableEquipment: [],
      level: 'beginner',
      sessionLengthMinutes: 45,
      catalog: equipmentCatalog,
    }, { env: { GEMINI_API_KEY: '' } });

    expect(draft.exercises.map(({ exerciseId }) => exerciseId)).toEqual([1]);
    expect(draft.exercises[0]?.equipment).toEqual([]);
  });

  it('filters catalog-declared location incompatibilities without inventing location data', async () => {
    const locationCatalog: RoutineDraftCatalogItem[] = [
      { ...catalog[0], availableLocations: ['gym'] },
      { ...catalog[1], availableLocations: ['home'] },
      catalog[2],
    ];

    const draft = await buildRoutineDraft({
      goal: 'fuerza',
      focusAreas: ['pecho'],
      location: 'home',
      level: 'beginner',
      sessionLengthMinutes: 45,
      catalog: locationCatalog,
    }, { env: { GEMINI_API_KEY: '' } });

    expect(draft.exercises.map(({ exerciseId }) => exerciseId)).toEqual([2]);
  });

  it('reports unsupported equipment validation when the catalog has no verified metadata', async () => {
    await expect(buildRoutineDraft({
      goal: 'fuerza',
      focusAreas: [],
      location: 'gym',
      availableEquipment: ['mancuernas'],
      level: 'beginner',
      sessionLengthMinutes: 45,
      catalog,
    }, { env: { GEMINI_API_KEY: '' } })).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'El catálogo no tiene metadatos verificados para validar el equipamiento indicado.',
    });
  });

  it('falls back after one repair when Gemini exceeds the routine volume bounds', async () => {
    const excessiveVolume = {
      name: 'Demasiado volumen',
      description: 'Excede el límite.',
      reason: 'Propuesta fuera de los límites.',
      kind: 'gym',
      restSeconds: 90,
      exercises: catalog.map((item, sortOrder) => ({
        exerciseId: item.id,
        sortOrder,
        targetSets: 8,
        targetReps: 30,
      })),
    };
    const fetchImpl = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(excessiveVolume) }] } }],
      }),
    } as Response);

    const draft = await buildRoutineDraft({
      goal: 'fuerza',
      focusAreas: [],
      location: 'gym',
      level: 'beginner',
      sessionLengthMinutes: 60,
      catalog,
    }, { env: { GEMINI_API_KEY: 'test-key' }, fetchImpl });

    expect(draft.source).toBe('fallback');
    expect(draft.exercises).toHaveLength(4);
    expect(draft.exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0)).toBeLessThanOrEqual(12);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

});
