/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import type { UseCoachAdaptResult } from '@/hooks/useCoachAdapt';

let params = new URLSearchParams();
const mockUseCoachAdapt = jest.fn<() => UseCoachAdaptResult>();

jest.mock('next/navigation', () => ({
  useSearchParams: () => params,
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/hooks/useCoachAdapt', () => ({
  useCoachAdapt: mockUseCoachAdapt,
}));

describe('Adaptar entrenamiento page', () => {
  it('renders an empty state when routineId is missing', async () => {
    params = new URLSearchParams();
    const Page = (await import('./page')).default;

    render(<Page />);

    expect(screen.getByText('Elegí un entrenamiento para adaptar')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ir a Entrenar' }).getAttribute('href')).toBe('/dashboard/session');
    expect(mockUseCoachAdapt).not.toHaveBeenCalled();
  });

  it('renders the adapt shell for a valid routine query', async () => {
    params = new URLSearchParams('routineId=12&routineName=Torso%20fuerte');
    mockUseCoachAdapt.mockReturnValue({
      step: 'comparacion',
      result: {
        original: { exerciseCount: 5, setCount: 16, estMinutes: 55 },
        adapted: { exerciseCount: 4, setCount: 11, estMinutes: 32 },
        exerciseDeltas: [],
        reason: 'Ajuste sugerido.',
        source: 'deterministic',
      },
      error: null,
      previewing: false,
      starting: false,
      startStatus: 'idle',
      previewWithContext: jest.fn<UseCoachAdaptResult['previewWithContext']>(),
      startWorkout: jest.fn<() => Promise<void>>(),
      adjustAgain: jest.fn<() => void>(),
    });
    const Page = (await import('./page')).default;

    render(<Page />);

    expect(screen.getByRole('heading', { name: 'Adaptar entrenamiento' })).toBeTruthy();
    expect(screen.getByText('Coach Atlas')).toBeTruthy();
    expect(screen.getAllByText('Torso fuerte').length).toBeGreaterThan(0);
    expect(screen.getByText('2. Comparación').getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('Se aplica solo a la sesión de hoy; tu rutina guardada no cambia.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Usar entrenamiento adaptado' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mantener entrenamiento original' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ajustar otra cosa' })).toBeTruthy();
  });
});
