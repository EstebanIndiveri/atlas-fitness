/**
 * @jest-environment node
 */
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { AppError } from '@/types/errors';
import type { RoutineDraft } from '@/lib/ai/routine-draft';
import type { ExerciseCatalogItem } from '@/types/exercise';

type RequireAuth = typeof import('@/lib/auth/middleware')['requireAuth'];
type ListExercises = typeof import('@/lib/services/exercises')['listExercises'];
type GenerateRoutineDraft = typeof import('@/lib/ai/routine-draft')['generateRoutineDraft'];
type BuildRoutineDraft = typeof import('@/lib/ai/routine-draft')['buildRoutineDraft'];

const mockRequireAuth = jest.fn<RequireAuth>();
const mockListExercises = jest.fn<ListExercises>();
const mockGenerateRoutineDraft = jest.fn<GenerateRoutineDraft>();
const mockBuildRoutineDraft = jest.fn<BuildRoutineDraft>();

jest.mock('@/lib/auth/middleware', () => {
  const actual = jest.requireActual<typeof import('@/lib/auth/middleware')>('@/lib/auth/middleware');
  return { ...actual, requireAuth: mockRequireAuth };
});

jest.mock('@/lib/services/exercises', () => ({
  listExercises: mockListExercises,
}));

jest.mock('@/lib/ai/routine-draft', () => {
  const actual = jest.requireActual<typeof import('@/lib/ai/routine-draft')>('@/lib/ai/routine-draft');
  return {
    ...actual,
    generateRoutineDraft: mockGenerateRoutineDraft,
    buildRoutineDraft: mockBuildRoutineDraft,
  };
});

let POST: typeof import('./route')['POST'];

const catalog: ExerciseCatalogItem[] = [
  { id: 1, slug: 'sentadilla', name: 'Sentadilla', muscleGroup: 'Piernas', instructions: 'Bajá.', imageUrl: null, videoUrl: null, isSystem: true },
];

const draft: RoutineDraft = {
  source: 'fallback',
  name: 'Coach Atlas · Fuerza',
  description: 'Borrador validado.',
  reason: 'Atlas eligió una sentadilla por el objetivo y el nivel.',
  kind: 'gym',
  restSeconds: 120,
  exercises: [
    { exerciseId: 1, exerciseName: 'Sentadilla', muscleGroup: 'Piernas', sortOrder: 0, targetSets: 3, targetReps: 8 },
  ],
};

function request(body: unknown, mode?: string): NextRequest {
  const url = new URL('http://localhost:3000/api/routines/coach');
  if (mode) url.searchParams.set('mode', mode);
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/routines/coach', () => {
  beforeAll(async () => {
    const module = await import('./route');
    POST = module.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: 7, sessionId: 's1', iat: 1, exp: 9999999999 });
    mockListExercises.mockResolvedValue(catalog);
    mockGenerateRoutineDraft.mockResolvedValue(draft);
    mockBuildRoutineDraft.mockResolvedValue(draft);
  });

  it('returns a typed validation error for an invalid brief', async () => {
    const response = await POST(request({ goal: '', daysPerWeek: 0, location: 'park', level: 'new' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'Brief de rutina inválido',
    });
    expect(mockGenerateRoutineDraft).not.toHaveBeenCalled();
  });

  it('generates a draft from the authenticated exercise catalog', async () => {
    const body = {
      goal: 'ganar fuerza',
      daysPerWeek: 3,
      location: 'gym',
      level: 'intermediate',
    } as const;

    const response = await POST(request(body));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(draft);
    expect(mockListExercises).toHaveBeenCalledWith(7);
    expect(mockBuildRoutineDraft).toHaveBeenCalledWith({
      goal: body.goal,
      focusAreas: [],
      availableEquipment: undefined,
      location: body.location,
      level: body.level,
      sessionLengthMinutes: 45,
      catalog,
    });
    expect(mockGenerateRoutineDraft).not.toHaveBeenCalled();
  });

  it('uses the reusable-session contract when a session duration is provided', async () => {
    const response = await POST(request({
      goal: 'ganar fuerza',
      focusAreas: ['piernas'],
      location: 'gym',
      level: 'intermediate',
      sessionLengthMinutes: 45,
      availableEquipment: ['mancuernas'],
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(draft);
    expect(mockBuildRoutineDraft).toHaveBeenCalledWith({
      goal: 'ganar fuerza',
      focusAreas: ['piernas'],
      location: 'gym',
      level: 'intermediate',
      sessionLengthMinutes: 45,
      availableEquipment: ['mancuernas'],
      catalog,
    });
    expect(mockGenerateRoutineDraft).not.toHaveBeenCalled();
  });

  it('returns only canonical eligible candidates for the unchanged proposal context', async () => {
    const candidateCatalog = [
      {
        ...catalog[0],
        equipment: ['barra'],
        availableLocations: ['gym'] as const,
      },
      {
        ...catalog[0],
        id: 2,
        slug: 'peso-muerto',
        name: 'Peso muerto',
        equipment: ['mancuernas'],
        availableLocations: ['gym'] as const,
      },
      {
        ...catalog[0],
        id: 3,
        slug: 'press-banca',
        name: 'Press de banca',
        muscleGroup: 'Pecho',
        equipment: ['barra'],
        availableLocations: ['gym'] as const,
      },
    ];
    mockListExercises.mockResolvedValue(candidateCatalog);
    const context = {
      goal: 'ganar fuerza',
      focusAreas: ['Piernas'],
      location: 'gym',
      availableEquipment: ['barra'],
      level: 'intermediate',
      sessionLengthMinutes: 45,
    } as const;

    const response = await POST(request(context, 'candidates'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([candidateCatalog[0]]);
    expect(mockListExercises).toHaveBeenCalledWith(7);
    expect(mockBuildRoutineDraft).not.toHaveBeenCalled();
    expect(mockGenerateRoutineDraft).not.toHaveBeenCalled();
  });

  it('returns typed errors from authentication and catalog access', async () => {
    mockRequireAuth.mockRejectedValue(new AppError('UNAUTHORIZED', 'Autenticación requerida'));

    const response = await POST(request({ goal: 'salud', daysPerWeek: 1, location: 'home', level: 'beginner' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: 'UNAUTHORIZED',
      message: 'Autenticación requerida',
    });
  });
});
