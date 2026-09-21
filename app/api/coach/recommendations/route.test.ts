/**
 * @jest-environment node
 */
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { AppError } from '@/types/errors';
import type { CoachRecommendationDto } from '@/lib/services/coach-recommendation';

type RequireAuth = typeof import('@/lib/auth/middleware')['requireAuth'];
type RecordCoachRecommendation =
  typeof import('@/lib/services/coach-recommendation')['recordCoachRecommendation'];

const mockRequireAuth = jest.fn<RequireAuth>();
const mockRecordCoachRecommendation = jest.fn<RecordCoachRecommendation>();

jest.mock('@/lib/auth/middleware', () => {
  const actual = jest.requireActual<typeof import('@/lib/auth/middleware')>('@/lib/auth/middleware');
  return {
    ...actual,
    requireAuth: mockRequireAuth,
  };
});

jest.mock('@/lib/services/coach-recommendation', () => ({
  recordCoachRecommendation: mockRecordCoachRecommendation,
}));

let POST: typeof import('./route')['POST'];

const recommendation: CoachRecommendationDto = {
  id: 101,
  userId: 7,
  workoutId: 42,
  dailyCheckInId: null,
  contextSnapshot: null,
  source: 'deterministic',
  result: {
    original: { exerciseCount: 2, setCount: 8, estMinutes: 30 },
    adapted: { exerciseCount: 2, setCount: 6, estMinutes: 24 },
    exerciseDeltas: [
      { exerciseId: 10, name: 'Sentadilla', action: 'reduced', fromSets: 4, toSets: 3 },
    ],
    reason: 'Bajamos volumen porque registraste energía baja.',
    source: 'deterministic',
  },
  decision: 'pending',
  decidedAt: null,
  createdAt: '2026-09-20T21:00:00.000Z',
  updatedAt: '2026-09-20T21:00:00.000Z',
};

function request(body: string | unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/coach/recommendations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/coach/recommendations', () => {
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
    mockRecordCoachRecommendation.mockResolvedValue(recommendation);
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new AppError('UNAUTHORIZED', 'Autenticación requerida'));

    const response = await POST(request({ workoutId: 42, source: 'deterministic', result: recommendation.result }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: 'UNAUTHORIZED',
      message: 'Autenticación requerida',
    });
    expect(mockRecordCoachRecommendation).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION for malformed JSON', async () => {
    const response = await POST(request('{"workoutId":'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'Recomendación de Coach Atlas inválida',
    });
    expect(mockRecordCoachRecommendation).not.toHaveBeenCalled();
  });

  it('records a recommendation with the authenticated userId instead of client userId', async () => {
    const response = await POST(request({
      userId: 999,
      workoutId: 42,
      source: 'deterministic',
      result: recommendation.result,
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(recommendation);
    expect(mockRecordCoachRecommendation).toHaveBeenCalledWith({
      userId: 7,
      workoutId: 42,
      source: 'deterministic',
      result: recommendation.result,
    });
  });
});
