import { afterEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

declare const jest: typeof import('@jest/globals').jest;

jest.mock('@/hooks/useHabits', () => ({
  useHabits: jest.fn(),
}));

import { useHabits as useHabitsHook } from '@/hooks/useHabits';
import { TodayHabitsCard } from './TodayHabitsCard';

const useHabits = jest.mocked(useHabitsHook);

function mockHabits(overrides: Partial<ReturnType<typeof useHabitsHook>> = {}) {
  const toggle = jest.fn<ReturnType<typeof useHabitsHook>['toggle']>().mockResolvedValue(undefined);
  const reload = jest.fn<ReturnType<typeof useHabitsHook>['reload']>();
  const value: ReturnType<typeof useHabitsHook> = {
    doneByKey: { hydration: false, walk: false, mobility: false, sleep: false },
    loading: false,
    saving: false,
    error: null,
    reload,
    toggle,
    ...overrides,
  };
  useHabits.mockReturnValue(value);
  return { toggle, reload };
}

describe('TodayHabitsCard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the heading and one checkbox per catalog habit reflecting done state', () => {
    mockHabits({ doneByKey: { hydration: true, walk: false, mobility: false, sleep: false } });
    render(<TodayHabitsCard />);

    expect(screen.getByRole('heading', { name: 'Hábitos de hoy' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    expect(screen.getByRole('checkbox', { name: /Hidratación/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByRole('checkbox', { name: /Caminar/ }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('toggles a habit through the hook when a row is activated', () => {
    const { toggle } = mockHabits();
    render(<TodayHabitsCard />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Dormir/ }));
    expect(toggle).toHaveBeenCalledWith('sleep');
  });

  it('shows a loading state while habits are loading', () => {
    mockHabits({ loading: true });
    render(<TodayHabitsCard />);

    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('shows an error state when loading fails', () => {
    mockHabits({ error: 'No pudimos cargar tus hábitos de hoy. Probá de nuevo en unos minutos.' });
    render(<TodayHabitsCard />);

    expect(
      screen.getByText('No pudimos cargar tus hábitos de hoy. Probá de nuevo en unos minutos.'),
    ).toBeTruthy();
  });

  it('never fabricates habit counts or progress numbers', () => {
    mockHabits({ doneByKey: { hydration: true, walk: true, mobility: false, sleep: false } });
    const { container } = render(<TodayHabitsCard />);

    expect(container.textContent).not.toMatch(/\d+\s*(de|\/)\s*\d+/);
    expect(container.textContent).not.toMatch(/%/);
  });
});
