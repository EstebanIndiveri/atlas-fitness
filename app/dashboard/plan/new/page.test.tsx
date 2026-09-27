/**
 * @jest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { PlanDayState, usePlanBuilder as usePlanBuilderHook } from '@/hooks/usePlanBuilder';
import type { CreateTrainingPlanResult, TrainingPlanDayOfWeek } from '@/lib/services/training-plan';
import type { RoutineSummary } from '@/types/routine';
import { TRAINING_PLAN_REPLACEMENT_CONFIRMATION } from '@/lib/copy/plan';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockGetActiveTrainingPlan = jest.fn<() => Promise<CreateTrainingPlanResult | null>>();

jest.mock('@/lib/api/training-plan', () => ({
  TrainingPlanClientError: class TrainingPlanClientError extends Error {},
  getActiveTrainingPlan: () => mockGetActiveTrainingPlan(),
}));

interface RoutineListState {
  routines: RoutineSummary[];
  loading: boolean;
  error: string | null;
}

const mockUseRoutineList = jest.fn<(trainingPlanId?: number) => RoutineListState>();
const mockUsePlanBuilder = jest.fn<
  (...args: unknown[]) => ReturnType<typeof usePlanBuilderHook>
>();

jest.mock('@/hooks/useRoutineList', () => ({
  useRoutineList: (trainingPlanId?: number) => mockUseRoutineList(trainingPlanId),
}));

jest.mock('@/hooks/usePlanBuilder', () => ({
  usePlanBuilder: (...args: unknown[]) => mockUsePlanBuilder(...args),
}));

function routine(id: number, name: string, isSystem: boolean): RoutineSummary {
  return {
    id,
    slug: `r-${id}`,
    name,
    description: null,
    kind: 'gym',
    restSeconds: 90,
    isSystem,
    exercises: [],
  };
}

function planAssignments(
  entries: Partial<Record<TrainingPlanDayOfWeek, number>>,
): Record<TrainingPlanDayOfWeek, PlanDayState> {
  const assignment = (routineId: number | null): PlanDayState => ({ routineId, note: '' });
  return {
    0: assignment(entries[0] ?? null),
    1: assignment(entries[1] ?? null),
    2: assignment(entries[2] ?? null),
    3: assignment(entries[3] ?? null),
    4: assignment(entries[4] ?? null),
    5: assignment(entries[5] ?? null),
    6: assignment(entries[6] ?? null),
  };
}

function activePlan(id: number): CreateTrainingPlanResult {
  return {
    plan: {
      id,
      userId: 1,
      name: 'Semana actual',
      goal: null,
      isActive: true,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      deletedAt: null,
    },
    schedule: [],
  };
}

function builderState(entries: Partial<Record<TrainingPlanDayOfWeek, number>>) {
  return {
    name: 'Semana',
    goal: '',
    assignments: planAssignments(entries),
    selectedCount: Object.keys(entries).length,
    canSubmit: true,
    submitting: false,
    error: null,
    setName: jest.fn(),
    setGoal: jest.fn(),
    setDayRoutine: jest.fn(),
    setDayNote: jest.fn(),
    submit: jest.fn(async () => null),
  };
}

describe('NewPlanPage routine links', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the active plan scope on routine links so plan-scoped routines still resolve', async () => {
    const active = activePlan(77);
    mockGetActiveTrainingPlan.mockResolvedValue(active);
    mockUseRoutineList.mockReturnValue({
      routines: [routine(42, 'Empuje plan', false)],
      loading: false,
      error: null,
    });
    mockUsePlanBuilder.mockReturnValue(builderState({ 1: 42 }));
    const { default: NewPlanPage } = await import('./page');

    render(<NewPlanPage />);

    const viewLink = await screen.findByRole('link', { name: 'Ver rutina Empuje plan' });
    expect(viewLink.getAttribute('href')).toBe('/dashboard/routines/42?trainingPlanId=77');
    expect(screen.queryByRole('link', { name: 'Editar rutina Empuje plan' })).toBeNull();
    expect(mockUseRoutineList).toHaveBeenCalledWith(77);
    expect(mockUsePlanBuilder).toHaveBeenCalledWith(expect.any(Array), { replacementPlan: active });
  });

  it('offers editing only for the user own plan-less routines when no plan is active', async () => {
    mockGetActiveTrainingPlan.mockResolvedValue(null);
    mockUseRoutineList.mockReturnValue({
      routines: [routine(10, 'Empuje propio', false), routine(99, 'Full body del sistema', true)],
      loading: false,
      error: null,
    });
    mockUsePlanBuilder.mockReturnValue(builderState({ 1: 10, 2: 99 }));
    const { default: NewPlanPage } = await import('./page');

    render(<NewPlanPage />);

    const ownView = await screen.findByRole('link', { name: 'Ver rutina Empuje propio' });
    expect(ownView.getAttribute('href')).toBe('/dashboard/routines/10');
    expect(screen.getByRole('link', { name: 'Editar rutina Empuje propio' }).getAttribute('href')).toBe(
      '/dashboard/routines/10/edit',
    );

    const systemView = screen.getByRole('link', { name: 'Ver rutina Full body del sistema' });
    expect(systemView.getAttribute('href')).toBe('/dashboard/routines/99');
    expect(
      screen.queryByRole('link', { name: 'Editar rutina Full body del sistema' }),
    ).toBeNull();

    expect(mockUseRoutineList).toHaveBeenCalledWith(undefined);
  });

  it('confirms the replacement and navigates to the newly saved plan', async () => {
    mockGetActiveTrainingPlan.mockResolvedValue(activePlan(77));
    mockUseRoutineList.mockReturnValue({
      routines: [routine(42, 'Empuje plan', false)],
      loading: false,
      error: null,
    });
    const created = activePlan(88);
    const submit = jest.fn(async () => created);
    mockUsePlanBuilder.mockReturnValue({ ...builderState({ 1: 42 }), submit });
    const { default: NewPlanPage } = await import('./page');

    render(<NewPlanPage />);

    const submitButton = await screen.findByTestId('plan-submit');
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    fireEvent.click(submitButton);

    expect(confirmSpy).toHaveBeenCalledWith(TRAINING_PLAN_REPLACEMENT_CONFIRMATION);
    expect(submit).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(submitButton);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/plan/88'));
  });
});
