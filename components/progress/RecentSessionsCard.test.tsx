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
            durationMinutes: 30,
            routineName: null,
          },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: /Entrenamiento libre/ })).toBeTruthy();
  });
});
