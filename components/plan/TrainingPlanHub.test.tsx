/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import type { TrainingPlanHubDto } from '@/types/training-plan-hub';

const mockUseTrainingPlanHub = jest.fn();

jest.mock('@/hooks/useTrainingPlanHub', () => ({
  useTrainingPlanHub: (planId: number) => mockUseTrainingPlanHub(planId),
}));

const days: TrainingPlanHubDto['days'] = [
  { dayOfWeek: 1, assignment: { kind: 'routine', routineId: 10, routineName: 'Empuje', routineDescription: 'Pecho y hombros', routineKind: 'gym', focus: 'Técnica' } },
  { dayOfWeek: 2, assignment: { kind: 'rest' } },
  { dayOfWeek: 3, assignment: { kind: 'routine', routineId: 20, routineName: 'Piernas', routineDescription: null, routineKind: 'home', focus: null } },
  { dayOfWeek: 4, assignment: { kind: 'rest' } },
  { dayOfWeek: 5, assignment: { kind: 'unavailable' } },
  { dayOfWeek: 6, assignment: { kind: 'rest' } },
  { dayOfWeek: 0, assignment: { kind: 'rest' } },
];

const planHub: TrainingPlanHubDto = {
  plan: {
    id: 77,
    name: 'Semana de fuerza',
    goal: 'Fuerza máxima',
    isActive: true,
    updatedAt: '2026-09-25T10:00:00.000Z',
  },
  days,
};

describe('TrainingPlanHub', () => {
  it('renders the actual plan data, labeled objective, all seven days, and safe routine actions', async () => {
    mockUseTrainingPlanHub.mockReturnValue({ status: 'ready', data: planHub, error: null });
    const { TrainingPlanHub } = await import('./TrainingPlanHub');

    render(<TrainingPlanHub planId={77} />);

    expect(screen.getByRole('heading', { name: 'Semana de fuerza' })).toBeTruthy();
    expect(screen.getByText('Plan activo')).toBeTruthy();
    expect(screen.getByText('Objetivo del plan')).toBeTruthy();
    expect(screen.getByText('Fuerza máxima')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    expect(screen.getByText('Lunes')).toBeTruthy();
    expect(screen.getByText('Domingo')).toBeTruthy();
    expect(screen.getByText('Empuje')).toBeTruthy();
    expect(screen.getByText('Técnica')).toBeTruthy();
    expect(screen.getByText('Pecho y hombros')).toBeTruthy();
    expect(screen.getAllByText('Descanso')).toHaveLength(4);
    expect(screen.getByText('Rutina no disponible')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Editar plan semanal' }).getAttribute('href')).toBe(
      '/dashboard/plan/77/edit',
    );
    expect(screen.getByRole('link', { name: 'Mejorar plan con Coach Atlas' }).getAttribute('href')).toBe(
      '/dashboard/plan/77/improve',
    );
    expect(screen.getByRole('link', { name: 'Ver rutina Empuje' }).getAttribute('href')).toBe(
      '/dashboard/routines/10',
    );
    expect(screen.queryByRole('link', { name: /Rutina no disponible/ })).toBeNull();
  });

  it('renders inactive status, loading, error, and not-found states with accessible feedback', async () => {
    mockUseTrainingPlanHub.mockReturnValue({ status: 'loading', data: null, error: null });
    const { TrainingPlanHub } = await import('./TrainingPlanHub');
    const { rerender } = render(<TrainingPlanHub planId={77} />);

    mockUseTrainingPlanHub.mockReturnValue({ status: 'loading', data: null, error: null });
    rerender(<TrainingPlanHub planId={77} />);
    expect(screen.getByRole('status')).toBeTruthy();

    mockUseTrainingPlanHub.mockReturnValue({
      status: 'error',
      data: null,
      error: 'No pudimos cargar tu plan. Probá de nuevo.',
    });
    rerender(<TrainingPlanHub planId={77} />);
    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar tu plan');

    mockUseTrainingPlanHub.mockReturnValue({ status: 'not_found', data: null, error: null });
    rerender(<TrainingPlanHub planId={77} />);
    expect(screen.getByRole('heading', { name: 'Plan no encontrado' })).toBeTruthy();

    mockUseTrainingPlanHub.mockReturnValue({
      status: 'ready',
      data: { ...planHub, plan: { ...planHub.plan, isActive: false } },
      error: null,
    });
    rerender(<TrainingPlanHub planId={77} />);
    expect(screen.getByText('Plan inactivo')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Mejorar plan con Coach Atlas' })).toBeNull();
  });

  it('uses a narrow-screen-first day grid and semantic landmark labels', async () => {
    mockUseTrainingPlanHub.mockReturnValue({ status: 'ready', data: planHub, error: null });
    const { TrainingPlanHub } = await import('./TrainingPlanHub');

    render(<TrainingPlanHub planId={77} />);

    expect(screen.getByRole('region', { name: 'Plan semanal' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Tu semana' })).toBeTruthy();
    expect(screen.getByTestId('plan-hub-week-grid').className).toContain('grid-cols-1');
    expect(screen.getByTestId('plan-hub-week-grid').className).toContain('sm:grid-cols-2');
  });
});
