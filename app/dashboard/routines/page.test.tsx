/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';

import type { useRoutineList as useRoutineListHook } from '@/hooks/useRoutineList';
import type { RoutineSummary } from '@/types/routine';

jest.mock('@/hooks/useRoutineList', () => ({ useRoutineList: jest.fn() }));

const routine: RoutineSummary = {
  id: 1,
  slug: 'fuerza-base',
  name: 'Fuerza base',
  description: 'Rutina para probar CTAs.',
  kind: 'gym',
  restSeconds: 90,
  isSystem: false,
  exercises: [
    {
      id: 10,
      routineId: 1,
      exerciseId: 100,
      sortOrder: 0,
      targetSets: 3,
      targetReps: 8,
      exerciseName: 'Sentadilla',
      muscleGroup: 'Piernas',
      instructions: 'Bajá controlado.',
      imageUrl: null,
      videoUrl: null,
    },
  ],
};

describe('RoutinesPage', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders distinct Coach Atlas and manual creation entry points', async () => {
    const { useRoutineList } = await import('@/hooks/useRoutineList');
    jest.mocked(useRoutineList as typeof useRoutineListHook).mockReturnValue({
      routines: [routine],
      loading: false,
      error: null,
      deletingId: null,
      reload: jest.fn<() => void>(),
      remove: jest.fn<(id: number) => Promise<boolean>>(),
    });
    const { default: RoutinesPage } = await import('./page');

    render(<RoutinesPage />);

    const coachCta = screen.getByTestId('routine-create-coach-cta');
    const manualCta = screen.getByTestId('routine-create-cta');

    expect(coachCta.getAttribute('href')).toBe('/dashboard/routines/coach');
    expect(coachCta.textContent).toBe('Crear rutina con Coach Atlas');
    expect(coachCta.className).toContain('bg-brand');
    expect(manualCta.getAttribute('href')).toBe('/dashboard/routines/new');
    expect(manualCta.textContent).toBe('Crear rutina manual');
    expect(manualCta.className).toContain('ring-line');
  });

  it('shows a plan hub link when the active weekly plan exists', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          kind: 'rest_day',
          localDate: '2026-09-22',
          dayOfWeek: 2,
          trainingPlanId: 77,
          planGoal: null,
        }),
    })) as unknown as typeof fetch;
    const { useRoutineList } = await import('@/hooks/useRoutineList');
    jest.mocked(useRoutineList as typeof useRoutineListHook).mockReturnValue({
      routines: [routine],
      loading: false,
      error: null,
      deletingId: null,
      reload: jest.fn<() => void>(),
      remove: jest.fn<(id: number) => Promise<boolean>>(),
    });
    const { default: RoutinesPage } = await import('./page');

    render(<RoutinesPage />);

    await waitFor(() => {
      const link = screen.getByText('Gestionar plan');
      expect(link.getAttribute('href')).toBe('/dashboard/plan/77');
    });
  });

  it('routes plan management to new-plan creation when there is no active plan', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ kind: 'no_plan', localDate: '2026-09-22', dayOfWeek: 2 }),
    })) as unknown as typeof fetch;
    const { useRoutineList } = await import('@/hooks/useRoutineList');
    jest.mocked(useRoutineList as typeof useRoutineListHook).mockReturnValue({
      routines: [routine],
      loading: false,
      error: null,
      deletingId: null,
      reload: jest.fn<() => void>(),
      remove: jest.fn<(id: number) => Promise<boolean>>(),
    });
    const { default: RoutinesPage } = await import('./page');

    render(<RoutinesPage />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Crear plan semanal' }).getAttribute('href')).toBe(
        '/dashboard/plan/new',
      );
    });
  });

  it('surfaces plan lookup failures instead of treating them as an empty plan', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network unavailable');
    }) as unknown as typeof fetch;
    const { useRoutineList } = await import('@/hooks/useRoutineList');
    jest.mocked(useRoutineList as typeof useRoutineListHook).mockReturnValue({
      routines: [routine],
      loading: false,
      error: null,
      deletingId: null,
      reload: jest.fn<() => void>(),
      remove: jest.fn<(id: number) => Promise<boolean>>(),
    });
    const { default: RoutinesPage } = await import('./page');

    render(<RoutinesPage />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Crear plan semanal' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Gestionar plan' })).toBeNull();
  });
});
