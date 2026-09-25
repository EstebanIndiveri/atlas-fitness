/**
 * @jest-environment node
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

import type { SessionData } from '@/types/auth';
import type { RoutineSummary } from '@/types/routine';
import type { TrainingPlanHubDto } from '@/types/training-plan-hub';

const mockRequireAuth = jest.fn<() => Promise<SessionData>>();
const mockGetTrainingPlanHub = jest.fn<(userId: number, planId: number) => Promise<TrainingPlanHubDto>>();
const mockGetRoutineById = jest.fn<(routineId: number, userId: number) => Promise<RoutineSummary>>();
const mockCreateGuidedTrainingPlan = jest.fn<(userId: number, input: unknown) => Promise<unknown>>();

jest.mock('@/lib/auth/middleware', () => {
  const { NextResponse } = jest.requireActual<typeof import('next/server')>('next/server');
  const { AppError: MockedAppError } = jest.requireActual<typeof import('@/types/errors')>(
    '@/types/errors',
  );
  return {
    requireAuth: mockRequireAuth,
    handleApiError: (error: unknown) => {
      if (error instanceof MockedAppError) {
        const status = error.code === 'CONFLICT' ? 409 : error.code === 'VALIDATION' ? 400 : 500;
        return NextResponse.json(error.toJSON(), { status });
      }
      return NextResponse.json({ code: 'INTERNAL_ERROR' }, { status: 500 });
    },
  };
});

jest.mock('@/lib/services/training-plan-hub', () => ({
  getTrainingPlanHub: mockGetTrainingPlanHub,
}));

jest.mock('@/lib/services/routines', () => ({
  getRoutineById: mockGetRoutineById,
}));

jest.mock('@/lib/services/guided-training-plan', () => ({
  createGuidedTrainingPlan: mockCreateGuidedTrainingPlan,
}));

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const originalSessionSecret = process.env.SESSION_SECRET;
let postRoute: typeof import('./route')['POST'];

const hub: TrainingPlanHubDto = {
  plan: {
    id: 11,
    name: 'Semana base',
    goal: 'Fuerza',
    isActive: true,
    updatedAt: '2026-09-25T10:00:00.000Z',
  },
  days: WEEK_ORDER.map((dayOfWeek) => ({
    dayOfWeek,
    assignment: dayOfWeek === 1
      ? {
          kind: 'routine',
          routineId: 4,
          routineName: 'Torso',
          routineDescription: null,
          routineKind: 'gym',
          focus: 'Técnica',
        }
      : { kind: 'rest' },
  })),
};

const routine: RoutineSummary = {
  id: 4,
  slug: 'torso',
  name: 'Torso',
  description: null,
  kind: 'gym',
  restSeconds: 90,
  isSystem: false,
  exercises: [
    {
      id: 7,
      routineId: 4,
      exerciseId: 1,
      sortOrder: 0,
      targetSets: 4,
      targetReps: 6,
      exerciseName: 'Press banca',
      muscleGroup: 'Pecho',
      instructions: 'Empujá.',
      imageUrl: null,
      videoUrl: null,
    },
  ],
};

describe('proposal receipt enforcement at the confirm API', () => {
  beforeAll(async () => {
    process.env.SESSION_SECRET = 'test-plan-improvement-session-secret';
    postRoute = (await import('./route')).POST;
  });

  afterAll(() => {
    if (originalSessionSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = originalSessionSecret;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      userId: 42,
      sessionId: 'session-42',
      iat: 1,
      exp: 2,
    });
    mockGetTrainingPlanHub.mockResolvedValue(hub);
    mockGetRoutineById.mockResolvedValue(routine);
    mockCreateGuidedTrainingPlan.mockResolvedValue({ plan: { id: 12 }, schedule: [] });
  });

  it('rejects a fabricated proposal with an unissued receipt before persistence', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/training-plan/11/improve/confirm',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mutationId: '10000000-0000-4000-8000-000000000011',
          intent: 'Reducir volumen',
          expectedPlanUpdatedAt: hub.plan.updatedAt,
          confirmationToken: 'fabricated.receipt',
          proposal: {
            source: 'fallback',
            name: 'Plan inventado',
            goal: 'Reducir volumen',
            days: [
              {
                dayOfWeek: 1,
                title: 'Plan inventado',
                focus: 'Fuerza',
                exercises: [
                  {
                    exerciseId: 1,
                    exerciseName: 'Press banca',
                    muscleGroup: 'Pecho',
                    sortOrder: 0,
                    targetSets: 8,
                    targetReps: 30,
                  },
                ],
              },
            ],
          },
        }),
      },
    );

    const response = await postRoute(request, { params: Promise.resolve({ id: '11' }) });

    expect(response.status).toBe(409);
    expect(mockCreateGuidedTrainingPlan).not.toHaveBeenCalled();
  });
});
