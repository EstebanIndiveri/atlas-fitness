/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  confirmTrainingPlanImprovement,
  generateTrainingPlanImprovement,
} from './training-plan-improvement';
import type { TrainingPlanImprovementProposal } from '@/types/training-plan-improvement';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const validResponse: TrainingPlanImprovementProposal = {
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
    days: WEEK_ORDER.map((dayOfWeek) => ({
      dayOfWeek,
      assignment: dayOfWeek === 1
        ? {
            kind: 'routine' as const,
            routineId: 4,
            routineName: 'Torso',
            routineDescription: null,
            routineKind: 'gym',
            focus: 'Técnica',
            exercises: [
              { exerciseId: 1, exerciseName: 'Press banca', targetSets: 4, targetReps: 6 },
            ],
          }
        : { kind: 'rest' as const },
    })),
  },
  proposal: {
    source: 'fallback',
    name: 'Coach Atlas · Reducir volumen',
    goal: 'Reducir volumen',
    days: [{
      dayOfWeek: 1,
      title: 'Día 1',
      focus: 'Fuerza técnica',
      exercises: [{
        exerciseId: 1,
        exerciseName: 'Press banca',
        muscleGroup: 'Pecho',
        sortOrder: 0,
        targetSets: 3,
        targetReps: 8,
      }],
    }],
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('training-plan improvement API client', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.fn<typeof fetch>();
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests and validates a proposal for the selected plan and explicit intent', async () => {
    fetchMock.mockResolvedValue(jsonResponse(validResponse));

    const result = await generateTrainingPlanImprovement(11, 'Reducir volumen');

    expect(result).toEqual(validResponse);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/training-plan/11/improve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ intent: 'Reducir volumen' }),
      }),
    );
  });

  it('rejects an invalid proposal response instead of presenting a success state', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...validResponse, proposal: { days: [] } }));

    await expect(generateTrainingPlanImprovement(11, 'Reducir volumen')).rejects.toThrow(
      'La propuesta recibida no es válida.',
    );
  });

  it.each(['', 'x'.repeat(20_001)])(
    'rejects a missing or oversized confirmation receipt',
    async (confirmationToken) => {
      fetchMock.mockResolvedValue(jsonResponse({ ...validResponse, confirmationToken }));

      await expect(generateTrainingPlanImprovement(11, 'Reducir volumen')).rejects.toThrow(
        'La propuesta recibida no es válida.',
      );
    },
  );

  it('posts saving only to the explicit confirmation endpoint and returns the new plan id', async () => {
    const confirmation = {
      mutationId: '10000000-0000-4000-8000-000000000011',
      intent: 'Reducir volumen',
      expectedPlanUpdatedAt: validResponse.currentPlan.plan.updatedAt,
      confirmationToken: validResponse.confirmationToken,
      proposal: validResponse.proposal,
    };
    fetchMock.mockResolvedValue(jsonResponse({ plan: { id: 12 } }));

    const planId = await confirmTrainingPlanImprovement(11, confirmation);

    expect(planId).toBe(12);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/training-plan/11/improve/confirm',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(confirmation),
      }),
    );
  });
});
