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
const mockGetTrainingPlanById = jest.fn<
  (userId: number, planId: number) => Promise<CreateTrainingPlanResult>
>();
const mockUpdateTrainingPlan = jest.fn<
  (userId: number, planId: number, input: unknown) => Promise<CreateTrainingPlanResult>
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
  getTrainingPlanById: mockGetTrainingPlanById,
  updateTrainingPlan: mockUpdateTrainingPlan,
}));

let getRoute: typeof import('./route')['GET'];
let patchRoute: typeof import('./route')['PATCH'];

function request(method: 'GET' | 'PATCH', body?: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/training-plan/11', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function malformedPatch(): NextRequest {
  return new NextRequest('http://localhost:3000/api/training-plan/11', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: '{"name":',
  });
}

function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function session(userId: number): SessionData {
  return { userId, sessionId: `session-${userId}`, iat: 1, exp: 2 };
}

function resultFor(userId: number): CreateTrainingPlanResult {
  const plan: TrainingPlan = {
    id: 11,
    userId,
    name: 'Semana base',
    goal: null,
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
      note: null,
      createdAt: new Date('2026-09-19T12:00:00.000Z'),
    },
  ];

  return { plan, schedule };
}

describe('/api/training-plan/[id]', () => {
  beforeAll(async () => {
    const route = await import('./route');
    getRoute = route.GET;
    patchRoute = route.PATCH;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(new AppError('UNAUTHORIZED', 'Autenticación requerida'));

    const response = await getRoute(request('GET'), params('11'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: 'UNAUTHORIZED',
      message: 'Autenticación requerida',
    });
    expect(mockGetTrainingPlanById).not.toHaveBeenCalled();
  });

  it('GET validates the id and returns one owned plan', async () => {
    mockRequireAuth.mockResolvedValue(session(42));
    mockGetTrainingPlanById.mockResolvedValue(resultFor(42));

    const response = await getRoute(request('GET'), params('11'));

    expect(response.status).toBe(200);
    expect(mockGetTrainingPlanById).toHaveBeenCalledWith(42, 11);
    await expect(response.json()).resolves.toMatchObject({
      plan: { id: 11, userId: 42 },
      schedule: [{ dayOfWeek: 1, routineId: 7 }],
    });
  });

  it('GET rejects partially numeric ids without loading a plan', async () => {
    mockRequireAuth.mockResolvedValue(session(42));

    const response = await getRoute(request('GET'), params('11abc'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'ID de plan inválido',
    });
    expect(mockGetTrainingPlanById).not.toHaveBeenCalled();
  });

  it('GET maps missing or foreign plans to 404', async () => {
    mockRequireAuth.mockResolvedValue(session(42));
    mockGetTrainingPlanById.mockRejectedValue(new AppError('NOT_FOUND', 'Plan no encontrado'));

    const response = await getRoute(request('GET'), params('999'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ code: 'NOT_FOUND', message: 'Plan no encontrado' });
  });

  it('PATCH returns 400 for malformed JSON or non-object bodies', async () => {
    mockRequireAuth.mockResolvedValue(session(42));

    const malformed = await patchRoute(malformedPatch(), params('11'));
    const nonObject = await patchRoute(request('PATCH', []), params('11'));

    expect(malformed.status).toBe(400);
    expect(nonObject.status).toBe(400);
    expect(mockUpdateTrainingPlan).not.toHaveBeenCalled();
  });

  it('PATCH validates the id and updates with the session user id', async () => {
    mockRequireAuth.mockResolvedValue(session(42));
    mockUpdateTrainingPlan.mockResolvedValue(resultFor(42));

    const body = {
      userId: 999,
      name: 'Semana editada',
      schedule: [{ dayOfWeek: 3, routineId: 7 }],
    };
    const response = await patchRoute(request('PATCH', body), params('11'));

    expect(response.status).toBe(200);
    expect(mockUpdateTrainingPlan).toHaveBeenCalledWith(42, 11, {
      name: 'Semana editada',
      schedule: [{ dayOfWeek: 3, routineId: 7 }],
    });
  });

  it('PATCH maps empty schedule, invalid day, and foreign plan errors from the service', async () => {
    mockRequireAuth.mockResolvedValue(session(42));
    mockUpdateTrainingPlan.mockRejectedValue(
      new AppError('VALIDATION', 'El plan debe tener al menos un día asignado'),
    );

    const validation = await patchRoute(request('PATCH', { name: 'Vacío', schedule: [] }), params('11'));
    expect(validation.status).toBe(400);
    await expect(validation.json()).resolves.toEqual({
      code: 'VALIDATION',
      message: 'El plan debe tener al menos un día asignado',
    });

    mockUpdateTrainingPlan.mockRejectedValue(new AppError('NOT_FOUND', 'Plan no encontrado'));
    const notFound = await patchRoute(
      request('PATCH', { name: 'Otro', schedule: [{ dayOfWeek: 1, routineId: 7 }] }),
      params('11'),
    );
    expect(notFound.status).toBe(404);
  });
});
