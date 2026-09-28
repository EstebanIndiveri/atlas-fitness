import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react';

declare const jest: typeof import('@jest/globals').jest;

jest.mock('@/hooks/useHabits', () => ({
  useHabits: jest.fn(),
}));

jest.mock('@/hooks/useHabitActivity', () => ({
  useHabitActivity: jest.fn(),
}));

import { useHabitActivity as useHabitActivityHook } from '@/hooks/useHabitActivity';
import { useHabits as useHabitsHook } from '@/hooks/useHabits';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import HabitsPage from './page';

const useHabits = jest.mocked(useHabitsHook);
const useHabitActivity = jest.mocked(useHabitActivityHook);

function mockHabits(overrides: Partial<ReturnType<typeof useHabitsHook>> = {}) {
  const value: ReturnType<typeof useHabitsHook> = {
    doneByKey: { hydration: false, walk: false, mobility: false, sleep: false },
    amountByKey: { hydration: null, walk: null, mobility: null, sleep: null },
    loading: false,
    saving: false,
    error: null,
    reload: jest.fn(),
    toggle: jest.fn<ReturnType<typeof useHabitsHook>['toggle']>().mockResolvedValue(undefined),
    addAmount: jest
      .fn<ReturnType<typeof useHabitsHook>['addAmount']>()
      .mockResolvedValue(undefined),
    clearAmount: jest
      .fn<ReturnType<typeof useHabitsHook>['clearAmount']>()
      .mockResolvedValue(undefined),
    ...overrides,
  };
  useHabits.mockReturnValue(value);
  return value;
}

describe('HabitsPage', () => {
  beforeEach(() => {
    useHabitActivity.mockReturnValue({
      activity: null,
      loading: false,
      error: null,
      reload: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders today’s real manual habit state and routes controls through useHabits', () => {
    const habits = mockHabits({
      doneByKey: { hydration: true, walk: true, mobility: false, sleep: false },
      amountByKey: { hydration: '1.5', walk: null, mobility: null, sleep: null },
    });

    render(<HabitsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Hábitos' })).toBeTruthy();
    expect(screen.getByText('2 de 4 completados')).toBeTruthy();
    expect(screen.getByText('1,5 L')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Pasos Activos' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(
      screen.getByRole('checkbox', { name: 'Descanso & Sueño' }).getAttribute('aria-checked'),
    ).toBe('false');
    expect(screen.queryByText(/racha|objetivo diario|historial|recordatorio/i)).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Descanso & Sueño' }));
    fireEvent.click(screen.getByRole('button', { name: /Sumar 0,25 L Hidratación/ }));

    expect(habits.toggle).toHaveBeenCalledWith('sleep');
    expect(habits.addAmount).toHaveBeenCalledWith('hydration');
  });

  it('shows a loading state before rendering habit values', () => {
    mockHabits({ loading: true });

    render(<HabitsPage />);

    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText('0 de 4 completados')).toBeNull();
  });

  it('shows an honest unrecorded state when today has no habit logs', () => {
    mockHabits();

    render(<HabitsPage />);

    expect(screen.getByText('0 de 4 completados')).toBeTruthy();
    expect(screen.getByText('Sin registrar hoy')).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: 'Pasos Activos' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(screen.queryByText(/\b0 L\b/)).toBeNull();
  });

  it('shows an unavailable state without presenting empty defaults as today’s data', () => {
    const habits = mockHabits({ error: 'No pudimos cargar tus hábitos de hoy.' });

    render(<HabitsPage />);

    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar tus hábitos de hoy.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(habits.reload).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('habits-list')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText('0 de 4 completados')).toBeNull();
    expect(screen.queryByText('Sin registrar hoy')).toBeNull();
  });

  it('shows the read-only activity record beside today’s list and never inside it', () => {
    mockHabits();
    useHabitActivity.mockReturnValue({
      activity: null,
      loading: false,
      error: PROGRESS_COPY.habitActivity.unavailable,
      reload: jest.fn(),
    });

    render(<HabitsPage />);

    const habitsList = screen.getByTestId('habits-list');
    const record = screen.getByTestId('habit-activity-history');

    expect(within(habitsList).getAllByRole('listitem')).toHaveLength(4);
    expect(habitsList.contains(record)).toBe(false);
    expect(
      screen.getByRole('radiogroup', { name: PROGRESS_COPY.habitActivity.periodAria }),
    ).toBeTruthy();
    expect(within(record).getByTestId('habit-activity-history-error').textContent).toBe(
      PROGRESS_COPY.habitActivity.unavailable,
    );
    expect(within(record).queryByRole('alert')).toBeNull();
    expect(within(record).queryByRole('status')).toBeNull();
    expect(within(record).queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('keeps today’s count and points from it at the record below', () => {
    mockHabits({ doneByKey: { hydration: true, walk: true, mobility: false, sleep: false } });

    render(<HabitsPage />);

    expect(screen.getByText('2 de 4 completados')).toBeTruthy();
    const pointer = screen.getByText(PROGRESS_COPY.habits.todayOnly(2, 4));
    expect(pointer.closest('[data-testid="habits-list"]')).toBeNull();
    expect(
      pointer.compareDocumentPosition(screen.getByTestId('habit-activity-history')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
