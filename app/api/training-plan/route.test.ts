/**
 * @jest-environment node
 */
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { AppError } from '@/types/errors';
import type { CreateTrainingPlanResult } from '@/lib/services/training-plan';
import type { ScheduledRoutine, TrainingPlan } from '@/lib/db/schema';
import type { SessionData } from '@/types/auth';

const mockRequireAuth = jest.fn<() => Promise<SessionData>>();
const mockCreateTrainingPlan = jest.fn<
  (input: unknown) => Promise<CreateTrainingPlanResult>
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

jest.mock('@/lib/services/training-plan', () => ({
  createTrainingPlan: mockCreateTrainingPlan,
}));

let post: typeof import('./route')['POST'];

function jsonPost(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/training-plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function malformedPost(): NextRequest {
  return new NextRequest('http://localhost:3000/api/training-plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"name":',
  });
}

function session(userId: number): SessionData {
  return { userId, sessionId: `session-${userId}`, iat: 1, exp: 2 };
}

function resultFor(userId: number): CreateTrainingPlanResult {
  const plan: TrainingPlan = {
    id: 11,
    userId,
    name: 'Semana base',
    isActive: true,
    createdAt: new Date('2026-09-19T12:00:00.000Z'),
    updatedAt: new Date('2026-09-19T12:00:00.000Z'),
    deletedAt: null,
  };
  const schedule: ScheduledRoutine[] = [
    {
      id: 21,
      trainingPlanId: plan.id,
      dayOfWeek: 1,
      routineId: 7,
      createdAt: new Date('2026-09-19T12:00:00.000Z'),
    },
  ];

  return { plan, schedule };
}

describe('POST /api/training-plan', () => {
  beforeAll(async () => {
    const route = await import('./route');
    post = route.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when the user is unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new AppError('UNAUTHORIZED', 'Autenticación requerida'));

    const response = await post(jsonPost({ name: 'Semana base', schedule: [] }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: 'UNAUTHORIZED',
      message: 'Autenticación requerida',
    });
    expect(mockCreateTrainingPlan).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION when the JSON body is malformed', async () => {
    mockRequireAuth.mockResolvedValue(session(42));

    const response = await post(malformedPost());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'Plan inválido',
    });
    expect(mockCreateTrainingPlan).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION when the JSON body is not an object', async () => {
    mockRequireAuth.mockResolvedValue(session(42));

    const response = await post(jsonPost([{ name: 'Semana base' }]));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'Plan inválido',
    });
    expect(mockCreateTrainingPlan).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION when the service rejects an empty schedule', async () => {
    mockRequireAuth.mockResolvedValue(session(42));
    mockCreateTrainingPlan.mockRejectedValue(
      new AppError('VALIDATION', 'El plan debe tener al menos un día asignado'),
    );

    const response = await post(jsonPost({ name: 'Semana base', schedule: [] }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'El plan debe tener al menos un día asignado',
    });
  });

  it('returns 200 with the created plan and schedule', async () => {
    const created = resultFor(42);
    mockRequireAuth.mockResolvedValue(session(42));
    mockCreateTrainingPlan.mockResolvedValue(created);

    const response = await post(
      jsonPost({ name: 'Semana base', schedule: [{ dayOfWeek: 1, routineId: 7 }] }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      plan: { id: 11, userId: 42, name: 'Semana base' },
      schedule: [{ id: 21, dayOfWeek: 1, routineId: 7 }],
    });
  });

  it('uses the session userId when the body attempts to override it', async () => {
    mockRequireAuth.mockResolvedValue(session(42));
    mockCreateTrainingPlan.mockResolvedValue(resultFor(42));

    await post(
      jsonPost({
        userId: 999,
        name: 'Semana base',
        schedule: [{ dayOfWeek: 1, routineId: 7 }],
      }),
    );

    expect(mockCreateTrainingPlan).toHaveBeenCalledWith({
      userId: 42,
      name: 'Semana base',
      schedule: [{ dayOfWeek: 1, routineId: 7 }],
    });
  });
});
