/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';

import type { TodayResponse } from '@/lib/api/today';
import type { RoutineDetail } from '@/lib/api/routine-detail';

type UseTodayResult = {
  today: TodayResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

const mockUseToday = jest.fn<() => UseTodayResult>();
const mockFetchRoutineDetail = jest.fn<(routineId: number) => Promise<RoutineDetail>>();

jest.mock('@/hooks/useToday', () => ({
  useToday: mockUseToday,
}));

jest.mock('@/lib/api/routine-detail', () => ({
  fetchRoutineDetail: mockFetchRoutineDetail,
}));

async function renderHero(props: { onStartWorkout?: () => void; onAdapt?: () => void; onCreatePlan?: () => void } = {}): Promise<RenderResult> {
  const { TodayWorkoutHero } = await import('./TodayWorkoutHero');
  let view: RenderResult | undefined;
  await act(async () => {
    view = render(<TodayWorkoutHero {...props} />);
  });
  if (!view) {
    throw new Error('TodayWorkoutHero did not render');
  }
  return view;
}

function useTodayState(today: TodayResponse | null, overrides: { loading?: boolean; error?: string | null; reload?: () => void } = {}): void {
  mockUseToday.mockReturnValue({
    today,
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
    reload: overrides.reload ?? jest.fn(),
  });
}

function workoutToday(): TodayResponse {
  return {
    kind: 'workout',
    localDate: '2026-09-20',
    dayOfWeek: 0,
    trainingPlanId: 1,
    scheduledRoutineId: 2,
    routineId: 7,
    routineName: 'Empuje y torso superior',
  };
}

function routineDetail(): RoutineDetail {
  return {
    id: 7,
    slug: 'empuje-torso-u1',
    name: 'Empuje y torso superior',
    description: 'Foco en pecho, hombros y tríceps.',
    kind: 'gym',
    restSeconds: 90,
    isSystem: false,
    exercises: [
      exercise(1, 4, 'Press banca'),
      exercise(2, 4, 'Press militar'),
      exercise(3, 3, 'Fondos'),
    ],
  };
}

function exercise(id: number, targetSets: number, exerciseName: string): RoutineDetail['exercises'][number] {
  return {
    id,
    routineId: 7,
    exerciseId: id + 10,
    sortOrder: id - 1,
    targetSets,
    targetReps: 8,
    exerciseName,
    muscleGroup: 'Torso',
    instructions: 'Controlá el movimiento.',
    imageUrl: null,
    videoUrl: null,
  };
}

describe('TodayWorkoutHero', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the loading state from useToday', async () => {
    useTodayState(null, { loading: true });

    await renderHero();

    expect(screen.getByRole('status').textContent).toMatch(/Cargando/);
  });

  it('renders today errors and retries through reload', async () => {
    const reload = jest.fn();
    useTodayState(null, { error: 'No se pudo cargar el plan de hoy', reload });

    await renderHero();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByRole('alert').textContent).toContain('No se pudo cargar el plan de hoy');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders workout detail with derived exercise and set metrics', async () => {
    useTodayState(workoutToday());
    mockFetchRoutineDetail.mockResolvedValue(routineDetail());

    await renderHero();

    expect(await screen.findByRole('heading', { name: 'Empuje y torso superior' })).toBeTruthy();
    expect(screen.getByText('Foco en pecho, hombros y tríceps.')).toBeTruthy();
    expect(screen.getByText('3 ejercicios')).toBeTruthy();
    expect(screen.getByText('11 series')).toBeTruthy();
    expect(screen.getByText('33 min')).toBeTruthy();
    expect(screen.getByText('Gimnasio')).toBeTruthy();
  });

  it('calls start and adapt actions from workout buttons', async () => {
    const onStartWorkout = jest.fn();
    const onAdapt = jest.fn();
    useTodayState(workoutToday());
    mockFetchRoutineDetail.mockResolvedValue(routineDetail());

    await renderHero({ onStartWorkout, onAdapt });

    fireEvent.click(await screen.findByRole('button', { name: /Empezar entrenamiento/ }));
    fireEvent.click(screen.getByRole('button', { name: /Adaptar con Coach Atlas/ }));

    expect(onStartWorkout).toHaveBeenCalledTimes(1);
    expect(onAdapt).toHaveBeenCalledTimes(1);
  });

  it('does not render fabricated stats while routine detail is loading', async () => {
    useTodayState(workoutToday());
    mockFetchRoutineDetail.mockReturnValue(new Promise(() => undefined));

    await renderHero();

    expect(screen.getByText('Cargando detalle de rutina…')).toBeTruthy();
    expect(screen.queryByText(/ejercicios/)).toBeNull();
    expect(screen.queryByText(/series/)).toBeNull();
  });

  it('renders no_plan empty state and calls create action', async () => {
    const onCreatePlan = jest.fn();
    useTodayState({ kind: 'no_plan', localDate: '2026-09-20', dayOfWeek: 0 });

    await renderHero({ onCreatePlan });
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi plan' }));

    expect(screen.getByRole('heading', { name: 'Todavía no tenés un plan' })).toBeTruthy();
    expect(onCreatePlan).toHaveBeenCalledTimes(1);
  });

  it('renders rest day without workout stats', async () => {
    useTodayState({ kind: 'rest_day', localDate: '2026-09-20', dayOfWeek: 0, trainingPlanId: 1 });

    await renderHero();

    expect(screen.getByRole('heading', { name: 'Hoy es día de descanso' })).toBeTruthy();
    expect(screen.queryByText(/series/)).toBeNull();
  });

  it('renders routine_missing as an unavailable scheduled routine with retry', async () => {
    const reload = jest.fn();
    useTodayState(
      {
        kind: 'routine_missing',
        localDate: '2026-09-20',
        dayOfWeek: 0,
        trainingPlanId: 1,
        scheduledRoutineId: 2,
        routineId: 7,
      },
      { reload },
    );

    await renderHero();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByRole('alert').textContent).toContain('La rutina programada no está disponible');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not update the UI after routine detail loading is cancelled', async () => {
    const first = workoutToday();
    const second = { ...workoutToday(), routineId: 8, routineName: 'Piernas' };
    let resolveFirst: (value: RoutineDetail) => void = () => undefined;
    const secondDetail: RoutineDetail = {
      ...routineDetail(),
      id: 8,
      name: 'Piernas',
      slug: 'piernas-u1',
      description: 'Trabajo de tren inferior.',
      kind: 'home',
      exercises: [exercise(9, 2, 'Sentadilla goblet')],
    };
    mockFetchRoutineDetail
      .mockReturnValueOnce(new Promise<RoutineDetail>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(secondDetail);
    useTodayState(first);
    const view = await renderHero();

    useTodayState(second);
    const { TodayWorkoutHero } = await import('./TodayWorkoutHero');
    await act(async () => {
      view.rerender(<TodayWorkoutHero />);
    });
    await act(async () => {
      resolveFirst(routineDetail());
    });

    await waitFor(() => expect(screen.getByText('Trabajo de tren inferior.')).toBeTruthy());
    expect(screen.getByRole('heading', { name: 'Piernas' })).toBeTruthy();
    expect(screen.getByText('Casa')).toBeTruthy();
    expect(screen.getByText('1 ejercicios')).toBeTruthy();
    expect(screen.getByText('2 series')).toBeTruthy();
    expect(screen.getByText('6 min')).toBeTruthy();
    expect(screen.queryByText('Foco en pecho, hombros y tríceps.')).toBeNull();
    expect(screen.queryByText('11 series')).toBeNull();
  });
});
