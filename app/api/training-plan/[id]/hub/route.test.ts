/**
 * @jest-environment node
 */
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { AppError } from '@/types/errors';
import type { TrainingPlanHubDto } from '@/types/training-plan-hub';
import type { SessionData } from '@/types/auth';

const mockRequireAuth = jest.fn<() => Promise<SessionData>>();
const mockGetTrainingPlanHub = jest.fn<(userId: number, planId: number) => Promise<TrainingPlanHubDto>>();

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

jest.mock('@/lib/services/training-plan-hub', () => ({
  getTrainingPlanHub: mockGetTrainingPlanHub,
}));

let getRoute: typeof import('./route')['GET'];

function request(): NextRequest {
  return new NextRequest('http://localhost:3000/api/training-plan/11/hub');
}

function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function session(userId: number): SessionData {
  return { userId, sessionId: `session-${userId}`, iat: 1, exp: 2 };
}

const orderedDays: TrainingPlanHubDto['days'][number]['dayOfWeek'][] = [1, 2, 3, 4, 5, 6, 0];

const hub: TrainingPlanHubDto = {
  plan: {
    id: 11,
    name: 'Semana base',
    goal: 'Fuerza',
    isActive: true,
    updatedAt: '2026-09-25T10:00:00.000Z',
  },
  days: orderedDays.map((dayOfWeek) => ({
    dayOfWeek,
    assignment: { kind: 'rest' },
  })),
};

describe('GET /api/training-plan/[id]/hub', () => {
  beforeAll(async () => {
    getRoute = (await import('./route')).GET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires authentication before reading a plan', async () => {
    mockRequireAuth.mockRejectedValue(new AppError('UNAUTHORIZED', 'Autenticación requerida'));

    const response = await getRoute(request(), params('11'));

    expect(response.status).toBe(401);
    expect(mockGetTrainingPlanHub).not.toHaveBeenCalled();
  });

  it('returns the typed hub for the authenticated owner', async () => {
    mockRequireAuth.mockResolvedValue(session(42));
    mockGetTrainingPlanHub.mockResolvedValue(hub);

    const response = await getRoute(request(), params('11'));

    expect(response.status).toBe(200);
    expect(mockGetTrainingPlanHub).toHaveBeenCalledWith(42, 11);
    await expect(response.json()).resolves.toEqual(hub);
  });

  it('rejects malformed ids and maps foreign ownership to 404', async () => {
    mockRequireAuth.mockResolvedValue(session(42));

    const invalid = await getRoute(request(), params('11abc'));
    expect(invalid.status).toBe(400);
    expect(mockGetTrainingPlanHub).not.toHaveBeenCalled();

    mockGetTrainingPlanHub.mockRejectedValue(new AppError('NOT_FOUND', 'Plan no encontrado'));
    const foreign = await getRoute(request(), params('11'));
    expect(foreign.status).toBe(404);
    await expect(foreign.json()).resolves.toEqual({
      code: 'NOT_FOUND',
      message: 'Plan no encontrado',
    });
  });
});
