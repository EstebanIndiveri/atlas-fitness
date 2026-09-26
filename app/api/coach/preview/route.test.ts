/**
 * @jest-environment node
 */
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { AppError } from '@/types/errors';
import type { CoachAdaptationResult } from '@/types/coach';

type RequireAuth = typeof import('@/lib/auth/middleware')['requireAuth'];
type PreviewCoachAdaptation =
  typeof import('@/lib/services/coach-preview')['previewCoachAdaptation'];

const mockRequireAuth = jest.fn<RequireAuth>();
const mockPreviewCoachAdaptation = jest.fn<PreviewCoachAdaptation>();

jest.mock('@/lib/auth/middleware', () => {
  const actual = jest.requireActual<typeof import('@/lib/auth/middleware')>('@/lib/auth/middleware');
  return {
    ...actual,
    requireAuth: mockRequireAuth,
  };
});

jest.mock('@/lib/services/coach-preview', () => ({
  previewCoachAdaptation: mockPreviewCoachAdaptation,
}));

let POST: typeof import('./route')['POST'];

const result: CoachAdaptationResult = {
  original: { exerciseCount: 1, setCount: 4, estMinutes: 12 },
  adapted: { exerciseCount: 1, setCount: 4, estMinutes: 12 },
  exerciseDeltas: [
    { exerciseId: 101, name: 'Sentadilla', action: 'kept', fromSets: 4, toSets: 4 },
  ],
  reason: 'Sin cambios: tu energía registrada permite mantener la rutina original.',
  source: 'deterministic',
};

function request(body: string | unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/coach/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/coach/preview', () => {
  beforeAll(async () => {
    const module = await import('./route');
    POST = module.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      userId: 7,
      sessionId: 's1',
      iat: 1,
      exp: Math.floor(Date.now() / 1000) + 1000,
    });
    mockPreviewCoachAdaptation.mockResolvedValue(result);
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new AppError('UNAUTHORIZED', 'Autenticación requerida'));

    const response = await POST(request({ routineId: 10 }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: 'UNAUTHORIZED',
      message: 'Autenticación requerida',
    });
    expect(mockPreviewCoachAdaptation).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION for malformed JSON', async () => {
    const response = await POST(request('{"routineId":'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'Preview de Coach Atlas inválido',
    });
    expect(mockPreviewCoachAdaptation).not.toHaveBeenCalled();
  });

  it('returns the preview JSON for a valid authenticated request', async () => {
    const response = await POST(request({
      routineId: 10,
      trainingPlanId: 31,
      energy: 'high',
      mood: 4,
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(result);
    expect(mockPreviewCoachAdaptation).toHaveBeenCalledWith({
      routineId: 10,
      trainingPlanId: 31,
      energy: 'high',
      mood: 4,
      userId: 7,
    });
  });

  it('surfaces routine ownership NOT_FOUND as 404 without leaking details', async () => {
    mockPreviewCoachAdaptation.mockRejectedValue(new AppError('NOT_FOUND', 'Rutina no encontrada'));

    const response = await POST(request({ routineId: 99, energy: 'medium', mood: 3 }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: 'NOT_FOUND',
      message: 'Rutina no encontrada',
    });
  });
});
