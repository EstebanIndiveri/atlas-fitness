import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { RecentSessionsCard } from './RecentSessionsCard';

describe('RecentSessionsCard', () => {
  it('renders recent sessions with real date, duration and routine name', () => {
    render(
      <RecentSessionsCard
        sessions={[
          {
            workoutId: 7,
            startedAt: '2026-09-24T12:00:00.000Z',
            durationMinutes: 65,
            routineName: 'Torso fuerte',
            totalVolumeKg: null,
          },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Sesiones recientes' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Torso fuerte/ }).getAttribute('href')).toBe(
      '/dashboard/workout/7',
    );
    expect(screen.getByText(/1h 5m/)).toBeTruthy();
    expect(screen.getByText(/24 de sept de 2026/)).toBeTruthy();
    expect(screen.getByText('Volumen no disponible')).toBeTruthy();
  });

  it('shows the real decimal volume and provenance when the session has eligible sets', () => {
    render(
      <RecentSessionsCard
        sessions={[
          {
            workoutId: 9,
            startedAt: '2026-09-24T12:00:00.000Z',
            durationMinutes: 50,
            routineName: 'Piernas',
            totalVolumeKg: '12.5',
          },
        ]}
      />,
    );

    expect(screen.queryByText('Volumen no disponible')).toBeNull();
    expect(screen.getByText('12.5 kg')).toBeTruthy();
    expect(screen.getByLabelText('Volumen de la sesión')).toBeTruthy();
    expect(screen.getAllByText('Calculado por Atlas')).toHaveLength(1);
  });

  it('keeps volume unavailable only when the session has no eligible sets', () => {
    render(
      <RecentSessionsCard
        sessions={[
          {
            workoutId: 10,
            startedAt: '2026-09-24T12:00:00.000Z',
            durationMinutes: 50,
            routineName: null,
            totalVolumeKg: null,
          },
        ]}
      />,
    );

    expect(screen.getByText('Volumen no disponible')).toBeTruthy();
    expect(screen.queryByText(/kg/)).toBeNull();
  });

  it('uses an empty state with a dashboard action when there are no sessions', () => {
    render(<RecentSessionsCard sessions={[]} />);

    expect(screen.getByRole('heading', { name: 'Todavía no hay entrenos' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Iniciar tu primer entrenamiento' }).getAttribute('href')).toBe(
      '/dashboard/today',
    );
  });

  it('handles null routine names honestly', () => {
    render(
      <RecentSessionsCard
        sessions={[
          {
            workoutId: 8,
            startedAt: '2026-09-23T12:00:00.000Z',
            durationMinutes: null,
            routineName: null,
            totalVolumeKg: null,
          },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: /Entrenamiento libre/ })).toBeTruthy();
    expect(screen.getByText('Duración no registrada')).toBeTruthy();
  });
});
