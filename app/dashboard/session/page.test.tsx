/**
 * @jest-environment jsdom
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';

import type { CreateTrainingPlanResult } from '@/lib/services/training-plan';
import type { UseTrainingLandingResult } from '@/hooks/useTrainingLanding';
import type { RoutineSummary } from '@/types/routine';

const mockUseTrainingLanding = jest.fn<() => UseTrainingLandingResult>();
const mockGetTrainingPlan = jest.fn<(planId: number) => Promise<CreateTrainingPlanResult>>();

jest.mock('@/hooks/useTrainingLanding', () => ({
  useTrainingLanding: mockUseTrainingLanding,
}));

jest.mock('@/lib/api/training-plan', () => ({
  getTrainingPlan: mockGetTrainingPlan,
}));

function routine(overrides: Partial<RoutineSummary> = {}): RoutineSummary {
  return {
    id: 12,
    slug: 'torso',
    name: 'Torso fuerte',
    description: null,
    kind: 'gym',
    restSeconds: 90,
    isSystem: false,
    exercises: [
      {
        id: 1,
        routineId: 12,
        exerciseId: 101,
        sortOrder: 0,
        targetSets: 4,
        targetReps: 8,
        exerciseName: 'Press banca',
        muscleGroup: 'Pecho',
        instructions: 'Controlado.',
        imageUrl: null,
        videoUrl: null,
      },
      {
        id: 2,
        routineId: 12,
        exerciseId: 102,
        sortOrder: 1,
        targetSets: 3,
        targetReps: 10,
        exerciseName: 'Remo',
        muscleGroup: 'Espalda',
        instructions: 'Controlado.',
        imageUrl: null,
        videoUrl: null,
      },
    ],
    ...overrides,
  };
}

describe('Entrenar page', () => {
  beforeEach(() => {
    mockUseTrainingLanding.mockReset();
    mockGetTrainingPlan.mockReset();
  });

  it('composes the training landing sections', async () => {
    const Page = (await import('./page')).default;
    mockUseTrainingLanding.mockReturnValue({
      today: { kind: 'no_plan', localDate: '2026-09-20', dayOfWeek: 0 },
      routines: [],
      activeWorkout: null,
      loading: false,
      error: null,
      starting: null,
      start: jest.fn<(routineId: number) => Promise<void>>(),
    });

    render(<Page />);

    expect(screen.getByRole('heading', { name: 'Entrenar' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Gestionar plan/ }).getAttribute('href')).toBe(
      '/dashboard/routines',
    );
    expect(screen.getByRole('heading', { name: 'Nueva rutina' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Mis rutinas' })).toBeTruthy();
    expect(mockGetTrainingPlan).not.toHaveBeenCalled();
  });

  it('renders upcoming plan days from persisted plan schedule and routines', async () => {
    const Page = (await import('./page')).default;
    mockUseTrainingLanding.mockReturnValue({
      today: {
        kind: 'workout',
        localDate: '2026-09-24',
        dayOfWeek: 4,
        trainingPlanId: 9,
        scheduledRoutineId: 90,
        routineId: 12,
        routineName: 'Torso fuerte',
        planGoal: 'Hipertrofia',
        dayReason: null,
        completion: { completed: 0, total: 2 },
      },
      routines: [routine(), routine({ id: 20, name: 'Piernas', exercises: [routine().exercises[0]!] })],
      activeWorkout: null,
      loading: false,
      error: null,
      starting: null,
      start: jest.fn<(routineId: number) => Promise<void>>(),
    });
    mockGetTrainingPlan.mockResolvedValue({
      plan: {
        id: 9,
        userId: 1,
        name: 'Semana',
        goal: 'Hipertrofia',
        isActive: true,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        updatedAt: new Date('2026-09-01T00:00:00.000Z'),
        deletedAt: null,
      },
      schedule: [
        {
          id: 91,
          trainingPlanId: 9,
          dayOfWeek: 5,
          routineId: 20,
          note: 'Fuerza',
          createdAt: new Date('2026-09-01T00:00:00.000Z'),
        },
        {
          id: 92,
          trainingPlanId: 9,
          dayOfWeek: 0,
          routineId: 12,
          note: null,
          createdAt: new Date('2026-09-01T00:00:00.000Z'),
        },
      ],
    });

    render(<Page />);

    expect(await screen.findByRole('heading', { name: 'Próximos días' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver plan completo →' }).getAttribute('href')).toBe(
      '/dashboard/plan/9/edit',
    );
    expect(await screen.findByText('VIE')).toBeTruthy();
    expect(screen.getByText('25')).toBeTruthy();
    expect(screen.getAllByText('Piernas')).toHaveLength(2);
    expect(screen.getAllByText('1 ejercicio · 4 series').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Fuerza')).toBeTruthy();
    expect(screen.getByText('Descanso programado')).toBeTruthy();
    expect(screen.getByText('Recuperación activa o reposo')).toBeTruthy();
    expect(screen.queryByText(/45 min/)).toBeNull();
    await waitFor(() => expect(mockGetTrainingPlan).toHaveBeenCalledWith(9));
  });

  it('does not render empty routine states when landing data failed to load', async () => {
    const Page = (await import('./page')).default;
    mockUseTrainingLanding.mockReturnValue({
      today: null,
      routines: [],
      activeWorkout: null,
      loading: false,
      error: 'No se pudo cargar Entrenar. Probá de nuevo en unos minutos.',
      starting: null,
      start: jest.fn<(routineId: number) => Promise<void>>(),
    });

    render(<Page />);

    expect(screen.getByText('No se pudo cargar Entrenar. Probá de nuevo en unos minutos.')).toBeTruthy();
    expect(screen.queryByText('Todavía no tenés rutinas')).toBeNull();
    expect(screen.queryByText('Todavía no tenés un plan')).toBeNull();
  });
});
