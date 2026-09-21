/**
 * @jest-environment node
 */
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import type { Workout } from '@/lib/db/schema';
import type { CoachAdaptationResult } from '@/types/coach';

type RequireAuth = typeof import('@/lib/auth/middleware')['requireAuth'];
type CreateWorkout = typeof import('@/lib/services/workouts')['createWorkout'];
type StartAdaptedWorkout =
  typeof import('@/lib/services/coach-adaptation-apply')['startAdaptedWorkout'];

const mockRequireAuth = jest.fn<RequireAuth>();
const mockCreateWorkout = jest.fn<CreateWorkout>();
const mockStartAdaptedWorkout = jest.fn<StartAdaptedWorkout>();

jest.mock('@/lib/auth/middleware', () => {
  const actual = jest.requireActual<typeof import('@/lib/auth/middleware')>('@/lib/auth/middleware');
  return {
    ...actual,
    requireAuth: mockRequireAuth,
  };
});

jest.mock('@/lib/services/workouts', () => ({
  createWorkout: mockCreateWorkout,
  listWorkouts: jest.fn(),
}));

jest.mock('@/lib/services/coach-adaptation-apply', () => ({
  startAdaptedWorkout: mockStartAdaptedWorkout,
}));

let POST: typeof import('./route')['POST'];

const workout = { id: 55, userId: 7, routineId: 12 } as unknown as Workout;

const result: CoachAdaptationResult = {
  original: { exerciseCount: 3, setCount: 9, estMinutes: 45 },
  adapted: { exerciseCount: 2, setCount: 6, estMinutes: 30 },
  exerciseDeltas: [
    { exerciseId: 10, name: 'Sentadilla', action: 'removed', fromSets: 3, toSets: 0 },
    { exerciseId: 11, name: 'Press', action: 'kept', fromSets: 3, toSets: 3 },
  ],
  reason: 'Menos tiempo disponible hoy',
  source: 'deterministic',
};

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/workouts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/workouts', () => {
  beforeAll(async () => {
    ({ POST } = await import('./route'));
  });

  beforeEach(() => {
    mockRequireAuth.mockReset();
    mockCreateWorkout.mockReset();
    mockStartAdaptedWorkout.mockReset();
    mockRequireAuth.mockResolvedValue({ userId: 7 } as Awaited<ReturnType<RequireAuth>>);
  });

  it('creates a plain workout without an adaptation', async () => {
    mockCreateWorkout.mockResolvedValue(workout);

    const response = await POST(request({ routineId: 12 }));

    expect(response.status).toBe(201);
    expect(mockCreateWorkout).toHaveBeenCalledWith(7, 12);
    expect(mockStartAdaptedWorkout).not.toHaveBeenCalled();
  });

  it('applies an adaptation via startAdaptedWorkout', async () => {
    mockStartAdaptedWorkout.mockResolvedValue({ workout, recommendation: null });

    const response = await POST(
      request({ routineId: 12, adaptation: { result, freeText: 'Tengo 30 minutos' } }),
    );

    expect(response.status).toBe(201);
    expect(mockStartAdaptedWorkout).toHaveBeenCalledWith({
      userId: 7,
      routineId: 12,
      result,
      contextSnapshot: { freeText: 'Tengo 30 minutos' },
    });
    expect(mockCreateWorkout).not.toHaveBeenCalled();
  });

  it('rejects an adaptation without a routineId', async () => {
    const response = await POST(request({ adaptation: { result } }));

    expect(response.status).toBe(400);
    expect(mockStartAdaptedWorkout).not.toHaveBeenCalled();
    expect(mockCreateWorkout).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const { AppError } = await import('@/types/errors');
    mockRequireAuth.mockRejectedValue(new AppError('UNAUTHORIZED', 'No autorizado'));

    const response = await POST(request({ routineId: 12 }));

    expect(response.status).toBe(401);
    expect(mockCreateWorkout).not.toHaveBeenCalled();
  });
});
