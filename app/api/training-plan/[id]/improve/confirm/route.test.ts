/**
 * @jest-environment node
 */
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import { AppError } from '@/types/errors';
import type { SessionData } from '@/types/auth';

const mockRequireAuth = jest.fn<() => Promise<SessionData>>();
const mockConfirmProposal = jest.fn<
  (userId: number, planId: number, input: unknown) => Promise<unknown>
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
  confirmTrainingPlanImprovement: mockConfirmProposal,
}));

let postRoute: typeof import('./route')['POST'];

function request(body: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/training-plan/11/improve/confirm', {
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

describe('POST /api/training-plan/[id]/improve/confirm', () => {
  beforeAll(async () => {
    postRoute = (await import('./route')).POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires authentication before applying an accepted proposal', async () => {
    mockRequireAuth.mockRejectedValue(new AppError('UNAUTHORIZED', 'Autenticación requerida'));

    const response = await postRoute(request('{"mutationId":"not-a-mutation"}'), params('11'));

    expect(response.status).toBe(401);
    expect(mockConfirmProposal).not.toHaveBeenCalled();
  });

  it('invokes the atomic confirmation service only through the explicit confirm endpoint', async () => {
    const input = { mutationId: 'accepted-proposal' };
    const result = { plan: { id: 12 }, schedule: [] };
    mockRequireAuth.mockResolvedValue(session(42));
    mockConfirmProposal.mockResolvedValue(result);

    const response = await postRoute(request(JSON.stringify(input)), params('11'));

    expect(response.status).toBe(200);
    expect(mockConfirmProposal).toHaveBeenCalledWith(42, 11, input);
    await expect(response.json()).resolves.toEqual(result);
  });

  it('rejects malformed ids and invalid JSON without applying a proposal', async () => {
    mockRequireAuth.mockResolvedValue(session(42));

    const malformedId = await postRoute(request('{}'), params('11abc'));
    expect(malformedId.status).toBe(400);

    const invalidJson = await postRoute(request('{'), params('11'));
    expect(invalidJson.status).toBe(400);
    expect(mockConfirmProposal).not.toHaveBeenCalled();
  });
});
