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

const mockRequireAuth = jest.fn<RequireAuth>();
const mockListExercises = jest.fn<ListExercises>();
const mockGenerateRoutineDraft = jest.fn<GenerateRoutineDraft>();

jest.mock('@/lib/auth/middleware', () => {
  const actual = jest.requireActual<typeof import('@/lib/auth/middleware')>('@/lib/auth/middleware');
  return { ...actual, requireAuth: mockRequireAuth };
});

jest.mock('@/lib/services/exercises', () => ({
  listExercises: mockListExercises,
}));

jest.mock('@/lib/ai/routine-draft', () => ({
  generateRoutineDraft: mockGenerateRoutineDraft,
}));

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

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/routines/coach', {
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
    expect(mockGenerateRoutineDraft).toHaveBeenCalledWith(body, catalog);
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
