/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import type { UseTrainingLandingResult } from '@/hooks/useTrainingLanding';

const mockUseTrainingLanding = jest.fn<() => UseTrainingLandingResult>();

jest.mock('@/hooks/useTrainingLanding', () => ({
  useTrainingLanding: mockUseTrainingLanding,
}));

describe('Entrenar page', () => {
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
    expect(screen.getAllByRole('link', { name: 'Gestionar plan' })[0]?.getAttribute('href')).toBe(
      '/dashboard/routines',
    );
    expect(screen.getByRole('heading', { name: 'Nueva rutina' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Mis rutinas' })).toBeTruthy();
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
