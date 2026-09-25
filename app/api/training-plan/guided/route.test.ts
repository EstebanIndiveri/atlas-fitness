/**
 * @jest-environment node
 */
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { AppError } from '@/types/errors';
import type { CreateTrainingPlanResult } from '@/lib/services/training-plan';
import type { SessionData } from '@/types/auth';

const mockRequireAuth = jest.fn<() => Promise<SessionData>>();
const mockCreateGuidedTrainingPlan = jest.fn<
  (userId: number, input: unknown) => Promise<CreateTrainingPlanResult>
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

jest.mock('@/lib/services/guided-training-plan', () => ({
  createGuidedTrainingPlan: mockCreateGuidedTrainingPlan,
}));

let post: typeof import('./route')['POST'];

function jsonPost(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/training-plan/guided', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function session(userId: number): SessionData {
  return { userId, sessionId: `session-${userId}`, iat: 1, exp: 2 };
}

function resultFor(userId: number): CreateTrainingPlanResult {
  const createdAt = new Date('2026-09-25T12:00:00.000Z');
  return {
    plan: {
      id: 11,
      userId,
      name: 'Semana base',
      goal: 'Fuerza',
      isActive: true,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    },
    schedule: [
      {
        id: 21,
        trainingPlanId: 11,
        dayOfWeek: 1,
        routineId: 7,
        note: 'Empuje',
        createdAt,
      },
    ],
  };
}

describe('POST /api/training-plan/guided', () => {
  beforeAll(async () => {
    const route = await import('./route');
    post = route.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires authentication before writing the guided plan', async () => {
    mockRequireAuth.mockRejectedValue(new AppError('UNAUTHORIZED', 'Autenticación requerida'));

    const response = await post(jsonPost({ mutationId: 'client-id' }));

    expect(response.status).toBe(401);
    expect(mockCreateGuidedTrainingPlan).not.toHaveBeenCalled();
  });

  it('derives ownership from the authenticated session rather than the body', async () => {
    const input = {
      mutationId: 'a5e2cd80-5783-4aad-a2fd-cda735384a69',
      userId: 999,
      name: 'Semana base',
      goal: 'Fuerza',
      days: [],
    };
    mockRequireAuth.mockResolvedValue(session(42));
    mockCreateGuidedTrainingPlan.mockResolvedValue(resultFor(42));

    const response = await post(jsonPost(input));

    expect(response.status).toBe(200);
    expect(mockCreateGuidedTrainingPlan).toHaveBeenCalledWith(42, input);
    await expect(response.json()).resolves.toMatchObject({ plan: { userId: 42 } });
  });

  it('returns a typed conflict when a mutation ID is reused with a different payload', async () => {
    mockRequireAuth.mockResolvedValue(session(42));
    mockCreateGuidedTrainingPlan.mockRejectedValue(
      new AppError('CONFLICT', 'El ID de mutación ya fue utilizado'),
    );

    const response = await post(jsonPost({ mutationId: 'client-id' }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'CONFLICT' });
  });
});
