/**
 * @jest-environment node
 */
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { AppError } from '@/types/errors';

type RequireAuth = typeof import('@/lib/auth/middleware')['requireAuth'];
type GetProgression = typeof import('@/lib/services/exercise-progression')['getExerciseProgression'];

const mockRequireAuth = jest.fn<RequireAuth>();
const mockGetProgression = jest.fn<GetProgression>();

jest.mock('@/lib/auth/middleware', () => {
  const actual = jest.requireActual<typeof import('@/lib/auth/middleware')>('@/lib/auth/middleware');
  return { ...actual, requireAuth: mockRequireAuth };
});

jest.mock('@/lib/services/exercise-progression', () => {
  const actual =
    jest.requireActual<typeof import('@/lib/services/exercise-progression')>(
      '@/lib/services/exercise-progression',
    );
  return { ...actual, getExerciseProgression: mockGetProgression };
});

let GET: typeof import('./route')['GET'];

beforeAll(async () => {
  ({ GET } = await import('./route'));
});

beforeEach(() => {
  mockRequireAuth.mockReset();
  mockGetProgression.mockReset();
  mockRequireAuth.mockResolvedValue({
    userId: 7,
    sessionId: 's1',
    iat: 1,
    exp: 2,
  } as Awaited<ReturnType<RequireAuth>>);
});

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/exercises/7101/progression?${query}`);
}

const params = { params: Promise.resolve({ id: '7101' }) };

describe('GET /api/exercises/[id]/progression', () => {
  it('maps a valid query to the service and returns the DTO', async () => {
    const dto = { readStatus: 'no_history', metricId: 'same_reps_external_load' };
    mockGetProgression.mockResolvedValue(dto as Awaited<ReturnType<GetProgression>>);

    const response = await GET(
      request('reps=5&amountBasis=total&side=bilateral&limit=1&cursor=abc'),
      params,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(dto);
    expect(mockGetProgression).toHaveBeenCalledWith({
      exerciseId: 7101,
      userId: 7,
      reps: 5,
      amountBasis: 'total',
      side: 'bilateral',
      limit: 1,
      cursor: 'abc',
    });
  });

  it('rejects a missing or invalid cohort without calling the service', async () => {
    const missing = await GET(request('amountBasis=total&side=bilateral'), params);
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe('VALIDATION');

    const badSide = await GET(request('reps=5&amountBasis=total&side=alternating'), params);
    expect(badSide.status).toBe(400);

    const badBasis = await GET(request('reps=5&amountBasis=per_hand&side=bilateral'), params);
    expect(badBasis.status).toBe(400);

    expect(mockGetProgression).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValueOnce(new AppError('UNAUTHORIZED', 'No autorizado'));
    const response = await GET(request('reps=5&amountBasis=total&side=bilateral'), params);
    expect(response.status).toBe(401);
  });

  it('maps a NOT_FOUND exercise to 404', async () => {
    mockGetProgression.mockRejectedValueOnce(new AppError('NOT_FOUND', 'Ejercicio no encontrado'));
    const response = await GET(request('reps=5&amountBasis=total&side=bilateral'), params);
    expect(response.status).toBe(404);
  });

  it('maps a malformed cursor service error to VALIDATION', async () => {
    mockGetProgression.mockRejectedValueOnce(new AppError('VALIDATION', 'Cursor inválido'));
    const response = await GET(
      request('reps=5&amountBasis=total&side=bilateral&cursor=bad'),
      params,
    );
    expect(response.status).toBe(400);
  });
});
