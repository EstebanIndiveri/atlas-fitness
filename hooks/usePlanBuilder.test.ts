import { afterEach, describe, expect, it } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

import type { RoutineSummary } from '@/types/routine';
import type { CreateTrainingPlanResult } from '@/lib/services/training-plan';

declare const jest: typeof import('@jest/globals').jest;

jest.mock('@/lib/api/training-plan', () => {
  class MockTrainingPlanClientError extends Error {
    kind: 'unauthorized' | 'validation' | 'not_found' | 'conflict' | 'generic';
    status: number;
    api: { code: string; message: string } | null;

    constructor(
      kind: 'unauthorized' | 'validation' | 'not_found' | 'conflict' | 'generic',
      message: string,
      status: number,
      api: { code: string; message: string } | null = null,
    ) {
      super(message);
      this.name = 'TrainingPlanClientError';
      this.kind = kind;
      this.status = status;
      this.api = api;
    }
  }

  return {
    __esModule: true,
    TrainingPlanClientError: MockTrainingPlanClientError,
    createTrainingPlan: jest.fn(),
    updateTrainingPlan: jest.fn(),
  };
});

import { createTrainingPlan, TrainingPlanClientError, updateTrainingPlan } from '@/lib/api/training-plan';
import { usePlanBuilder } from './usePlanBuilder';
import { PLAN_COPY } from '@/lib/copy/plan';

const createTrainingPlanMock = jest.mocked(createTrainingPlan);
const updateTrainingPlanMock = jest.mocked(updateTrainingPlan);

function routine(id: number, name: string): RoutineSummary {
  return {
    id,
    slug: `r-${id}`,
    name,
    description: null,
    kind: 'gym',
    restSeconds: 90,
    isSystem: false,
    exercises: [],
  };
}

const routines: RoutineSummary[] = [routine(10, 'Empuje'), routine(20, 'Pierna')];

const planResult: CreateTrainingPlanResult = {
  plan: {
    id: 1,
    userId: 1,
    name: 'Semana',
    goal: null,
    isActive: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    deletedAt: null,
  },
  schedule: [],
};

afterEach(() => {
  createTrainingPlanMock.mockReset();
  updateTrainingPlanMock.mockReset();
});

describe('usePlanBuilder', () => {
  it('cannot submit until it has a name and at least one assigned day', () => {
    const { result } = renderHook(() => usePlanBuilder(routines));

    expect(result.current.canSubmit).toBe(false);
    expect(result.current.selectedCount).toBe(0);

    act(() => result.current.setName('Mi semana'));
    expect(result.current.canSubmit).toBe(false);

    act(() => result.current.setDayRoutine(1, 10));
    expect(result.current.selectedCount).toBe(1);
    expect(result.current.canSubmit).toBe(true);
  });

  it('submits only assigned days with trimmed name, goal and notes', async () => {
    createTrainingPlanMock.mockResolvedValue(planResult);
    const { result } = renderHook(() => usePlanBuilder(routines));

    act(() => {
      result.current.setName('  Semana base  ');
      result.current.setGoal('  Hipertrofia  ');
      result.current.setDayRoutine(1, 10);
      result.current.setDayNote(1, '  Empuje técnico  ');
      result.current.setDayRoutine(3, 20);
    });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.submit();
    });

    expect(outcome).not.toBeNull();
    expect(createTrainingPlanMock).toHaveBeenCalledTimes(1);
    expect(createTrainingPlanMock).toHaveBeenCalledWith({
      name: 'Semana base',
      goal: 'Hipertrofia',
      schedule: [
        { dayOfWeek: 1, routineId: 10, note: 'Empuje técnico' },
        { dayOfWeek: 3, routineId: 20, note: undefined },
      ],
    });
  });

  it('clears a day when set back to rest and omits empty goal', async () => {
    createTrainingPlanMock.mockResolvedValue(planResult);
    const { result } = renderHook(() => usePlanBuilder(routines));

    act(() => {
      result.current.setName('Semana');
      result.current.setDayRoutine(2, 10);
      result.current.setDayRoutine(2, null);
      result.current.setDayRoutine(5, 20);
    });

    expect(result.current.selectedCount).toBe(1);

    await act(async () => {
      await result.current.submit();
    });

    expect(createTrainingPlanMock).toHaveBeenCalledWith({
      name: 'Semana',
      schedule: [{ dayOfWeek: 5, routineId: 20, note: undefined }],
    });
  });

  it('does not call the API when it cannot submit', async () => {
    const { result } = renderHook(() => usePlanBuilder(routines));

    let outcome: unknown = 'unset';
    await act(async () => {
      outcome = await result.current.submit();
    });

    expect(outcome).toBeNull();
    expect(createTrainingPlanMock).not.toHaveBeenCalled();
  });

  it('surfaces the API error message and stops submitting', async () => {
    createTrainingPlanMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => usePlanBuilder(routines));

    act(() => {
      result.current.setName('Semana');
      result.current.setDayRoutine(1, 10);
    });

    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => expect(result.current.error).toBe(PLAN_COPY.genericError));
    expect(result.current.submitting).toBe(false);
  });

  it('surfaces the backend message when it is a TrainingPlanClientError', async () => {
    createTrainingPlanMock.mockRejectedValue(
      new TrainingPlanClientError('validation', 'Plan inválido', 400),
    );
    const { result } = renderHook(() => usePlanBuilder(routines));

    act(() => {
      result.current.setName('Semana');
      result.current.setDayRoutine(1, 10);
    });

    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => expect(result.current.error).toBe('Plan inválido'));
    expect(result.current.submitting).toBe(false);
  });

  it('initializes edit mode from an existing plan and patches the same id', async () => {
    updateTrainingPlanMock.mockResolvedValue(planResult);
    const { result } = renderHook(() =>
      usePlanBuilder(routines, {
        mode: 'edit',
        initialPlan: {
          plan: { ...planResult.plan, id: 77, name: 'Semana actual', goal: 'Fuerza' },
          schedule: [
            {
              id: 21,
              trainingPlanId: 77,
              dayOfWeek: 2,
              routineId: 10,
              note: 'Técnica',
              createdAt: new Date(0),
            },
          ],
        },
      }),
    );

    expect(result.current.name).toBe('Semana actual');
    expect(result.current.goal).toBe('Fuerza');
    expect(result.current.assignments[2]).toEqual({ routineId: 10, note: 'Técnica' });

    act(() => {
      result.current.setDayNote(2, '  Fuerza  ');
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(createTrainingPlanMock).not.toHaveBeenCalled();
    expect(updateTrainingPlanMock).toHaveBeenCalledWith(77, {
      name: 'Semana actual',
      goal: 'Fuerza',
      schedule: [{ dayOfWeek: 2, routineId: 10, note: 'Fuerza' }],
    });
  });
});
