/**
 * @jest-environment node
 */
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { AppError } from '@/types/errors';
import type { CoachRecommendationDto } from '@/lib/services/coach-recommendation';

type RequireAuth = typeof import('@/lib/auth/middleware')['requireAuth'];
type DecideCoachRecommendation =
  typeof import('@/lib/services/coach-recommendation')['decideCoachRecommendation'];

const mockRequireAuth = jest.fn<RequireAuth>();
const mockDecideCoachRecommendation = jest.fn<DecideCoachRecommendation>();

jest.mock('@/lib/auth/middleware', () => {
  const actual = jest.requireActual<typeof import('@/lib/auth/middleware')>('@/lib/auth/middleware');
  return {
    ...actual,
    requireAuth: mockRequireAuth,
  };
});

jest.mock('@/lib/services/coach-recommendation', () => ({
  decideCoachRecommendation: mockDecideCoachRecommendation,
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
    exerciseDeltas: [],
    reason: 'Bajamos volumen porque registraste energía baja.',
    source: 'deterministic',
  },
  decision: 'accepted',
  decidedAt: '2026-09-20T21:03:00.000Z',
  createdAt: '2026-09-20T21:00:00.000Z',
  updatedAt: '2026-09-20T21:03:00.000Z',
};

function request(id: number | string, body: string | unknown): NextRequest {
  return new NextRequest(`http://localhost:3000/api/coach/recommendations/${id}/decision`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function post(id: number | string, body: string | unknown) {
  return POST(request(id, body), { params: Promise.resolve({ id: String(id) }) });
}

describe('POST /api/coach/recommendations/[id]/decision', () => {
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
    mockDecideCoachRecommendation.mockResolvedValue(recommendation);
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new AppError('UNAUTHORIZED', 'Autenticación requerida'));

    const response = await post(101, { decision: 'accepted' });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: 'UNAUTHORIZED',
      message: 'Autenticación requerida',
    });
    expect(mockDecideCoachRecommendation).not.toHaveBeenCalled();
  });

  it('returns the decided recommendation for a valid accepted decision', async () => {
    const response = await post(101, { decision: 'accepted' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(recommendation);
    expect(mockDecideCoachRecommendation).toHaveBeenCalledWith({
      id: 101,
      userId: 7,
      decision: 'accepted',
    });
  });

  it('returns 400 VALIDATION for an invalid recommendation id param', async () => {
    const response = await post('abc', { decision: 'rejected' });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'ID de recomendación inválido',
    });
    expect(mockDecideCoachRecommendation).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION for malformed JSON', async () => {
    const response = await post(101, '{"decision":');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'Decisión de Coach Atlas inválida',
    });
    expect(mockDecideCoachRecommendation).not.toHaveBeenCalled();
  });
});
