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
  const addAmount = jest
    .fn<ReturnType<typeof useHabitsHook>['addAmount']>()
    .mockResolvedValue(undefined);
  const clearAmount = jest
    .fn<ReturnType<typeof useHabitsHook>['clearAmount']>()
    .mockResolvedValue(undefined);
  const reload = jest.fn<ReturnType<typeof useHabitsHook>['reload']>();
  const value: ReturnType<typeof useHabitsHook> = {
    doneByKey: { hydration: false, walk: false, mobility: false, sleep: false },
    amountByKey: { hydration: null, walk: null, mobility: null, sleep: null },
    loading: false,
    saving: false,
    error: null,
    reload,
    toggle,
    addAmount,
    clearAmount,
    ...overrides,
  };
  useHabits.mockReturnValue(value);
  return { toggle, reload, addAmount, clearAmount };
}

describe('TodayHabitsCard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Figma heading, honest completion count and one checkbox per boolean catalog habit', () => {
    mockHabits({ doneByKey: { hydration: true, walk: false, mobility: false, sleep: false } });
    render(<TodayHabitsCard />);

    expect(screen.getByRole('heading', { name: 'Hábitos Diarios' })).toBeTruthy();
    expect(screen.getByText('1 de 4 completados')).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: /Pasos Activos/ }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('keeps steps and sleep as honest toggle rows instead of fabricating values', () => {
    mockHabits({ doneByKey: { hydration: false, walk: true, mobility: false, sleep: true } });
    const { container } = render(<TodayHabitsCard />);

    expect(screen.getByRole('checkbox', { name: /Pasos Activos/ })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Descanso & Sueño/ })).toBeTruthy();
    expect(container.textContent).not.toContain('7,420');
    expect(container.textContent).not.toContain('7h 45m');
    expect(container.textContent).not.toContain('10k');
  });

  it('renders a quantitative stepper for hydration and reports the real amount', () => {
    mockHabits({ amountByKey: { hydration: '1.5', walk: null, mobility: null, sleep: null } });
    render(<TodayHabitsCard />);

    expect(screen.queryByRole('checkbox', { name: /Hidratación/ })).toBeNull();
    expect(screen.getByText('1,5 L')).toBeTruthy();
  });

  it('adds a hydration step through the hook when the add button is pressed', () => {
    const { addAmount } = mockHabits();
    render(<TodayHabitsCard />);

    fireEvent.click(screen.getByRole('button', { name: /Sumar 0,25 L Hidratación/ }));
    expect(addAmount).toHaveBeenCalledWith('hydration');
  });

  it('toggles a habit through the hook when a row is activated', () => {
    const { toggle } = mockHabits();
    render(<TodayHabitsCard />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Descanso & Sueño/ }));
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

  it('never fabricates habit target values or progress percentages', () => {
    mockHabits({ doneByKey: { hydration: true, walk: true, mobility: false, sleep: false } });
    const { container } = render(<TodayHabitsCard />);

    expect(screen.getByText('2 de 4 completados')).toBeTruthy();
    expect(container.textContent).not.toMatch(/%/);
  });
});
