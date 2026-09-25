/**
 * @jest-environment node
 */
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { AppError } from '@/types/errors';
import type { SessionData } from '@/types/auth';
import type { TrainingPlanImprovementProposal } from '@/types/training-plan-improvement';

const mockRequireAuth = jest.fn<() => Promise<SessionData>>();
const mockEnforceRateLimit = jest.fn<
  (request: NextRequest, userId: number) => Promise<void>
>();
const mockGenerateProposal = jest.fn<
  (userId: number, planId: number, input: unknown) => Promise<TrainingPlanImprovementProposal>
>();

jest.mock('@/lib/auth/middleware', () => {
  const { NextResponse } = jest.requireActual<typeof import('next/server')>('next/server');
  const { AppError: MockedAppError } = jest.requireActual<typeof import('@/types/errors')>(
    '@/types/errors',
  );
  return {
    requireAuth: mockRequireAuth,
    handleApiError: (error: unknown) => {
      if (error instanceof MockedAppError) {
        const statusByCode: Record<typeof error.code, number> = {
          UNAUTHORIZED: 401,
          FORBIDDEN: 403,
          NOT_FOUND: 404,
          VALIDATION: 400,
          CONFLICT: 409,
          RATE_LIMIT: 429,
          SERVICE_UNAVAILABLE: 503,
        };
        return NextResponse.json(error.toJSON(), { status: statusByCode[error.code] });
      }
      return NextResponse.json(
        { code: 'INTERNAL_ERROR', message: 'Internal server error' },
        { status: 500 },
      );
    },
  };
});

jest.mock('@/lib/services/training-plan-improvement', () => ({
  generateTrainingPlanImprovementProposal: mockGenerateProposal,
}));

jest.mock('@/lib/auth/weekly-plan-rate-limit', () => ({
  enforceWeeklyPlanGenerateRateLimit: mockEnforceRateLimit,
}));

let postRoute: typeof import('./route')['POST'];

function request(body: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/training-plan/11/improve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function session(userId: number): SessionData {
  return { userId, sessionId: `session-${userId}`, iat: 1, exp: 2 };
}

const responseProposal: TrainingPlanImprovementProposal = {
  intent: 'Reducir volumen',
  confirmationToken: 'signed-proposal-receipt',
  currentPlan: {
    plan: {
      id: 11,
      name: 'Semana base',
      goal: 'Fuerza',
      isActive: true,
      updatedAt: '2026-09-25T10:00:00.000Z',
    },
    days: [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => ({
      dayOfWeek: dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      assignment: { kind: 'rest' },
    })),
  },
  proposal: {
    source: 'fallback',
    name: 'Coach Atlas · Reducir volumen',
    goal: 'Reducir volumen',
    days: [
      {
        dayOfWeek: 1,
        title: 'Día 1',
        focus: 'Fuerza técnica',
        exercises: [
          {
            exerciseId: 7,
            exerciseName: 'Sentadilla',
            muscleGroup: 'Piernas',
            sortOrder: 0,
            targetSets: 3,
            targetReps: 8,
          },
        ],
      },
    ],
  },
};

describe('POST /api/training-plan/[id]/improve', () => {
  beforeAll(async () => {
    postRoute = (await import('./route')).POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires authentication before parsing or generating a proposal', async () => {
    mockRequireAuth.mockRejectedValue(new AppError('UNAUTHORIZED', 'Autenticación requerida'));

    const response = await postRoute(request('{"intent":"Reducir volumen"}'), params('11'));

    expect(response.status).toBe(401);
    expect(mockGenerateProposal).not.toHaveBeenCalled();
  });

  it('uses the path plan id and authenticated owner with an explicit intent', async () => {
    mockRequireAuth.mockResolvedValue(session(42));
    mockGenerateProposal.mockResolvedValue(responseProposal);
    const postRequest = request('{"intent":"Reducir volumen"}');

    const response = await postRoute(postRequest, params('11'));

    expect(response.status).toBe(200);
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(postRequest, 42);
    expect(mockGenerateProposal).toHaveBeenCalledWith(42, 11, { intent: 'Reducir volumen' });
    await expect(response.json()).resolves.toEqual(responseProposal);
  });

  it('rejects over-quota proposals before invoking the generator', async () => {
    mockRequireAuth.mockResolvedValue(session(42));
    mockEnforceRateLimit.mockRejectedValue(
      new AppError('RATE_LIMIT', 'Se alcanzó el límite de propuestas. Probá de nuevo en un minuto.'),
    );

    const response = await postRoute(request('{"intent":"Reducir volumen"}'), params('11'));

    expect(response.status).toBe(429);
    expect(mockGenerateProposal).not.toHaveBeenCalled();
  });

  it('rejects malformed ids and invalid JSON without calling the service', async () => {
    mockRequireAuth.mockResolvedValue(session(42));

    const malformedId = await postRoute(request('{"intent":"Reducir volumen"}'), params('11abc'));
    expect(malformedId.status).toBe(400);

    const invalidJson = await postRoute(request('{'), params('11'));
    expect(invalidJson.status).toBe(400);
    expect(mockGenerateProposal).not.toHaveBeenCalled();
  });
});
