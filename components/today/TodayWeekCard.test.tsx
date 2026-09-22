import { afterEach, describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import type { StreakStats } from '@/types/streak';
import type { WeekConsistency, WeekDayConsistency } from '@/types/week';

declare const jest: typeof import('@jest/globals').jest;

jest.mock('@/hooks/useStreak', () => ({
  useStreak: jest.fn(),
}));

jest.mock('@/hooks/useWeekConsistency', () => ({
  useWeekConsistency: jest.fn(),
}));

import { useStreak as useStreakHook } from '@/hooks/useStreak';
import { useWeekConsistency as useWeekConsistencyHook } from '@/hooks/useWeekConsistency';
import { TodayWeekCard } from './TodayWeekCard';

const useStreak = jest.mocked(useStreakHook);
const useWeekConsistency = jest.mocked(useWeekConsistencyHook);

function mockStreak(streak: StreakStats | null, overrides: Partial<ReturnType<typeof useStreakHook>> = {}) {
  useStreak.mockReturnValue({
    streak,
    loading: false,
    error: null,
    reload: jest.fn(),
    ...overrides,
  });
}

function buildDays(activeIndexes: number[], todayIndex: number): WeekDayConsistency[] {
  const dates = [
    '2026-09-21',
    '2026-09-22',
    '2026-09-23',
    '2026-09-24',
    '2026-09-25',
    '2026-09-26',
    '2026-09-27',
  ];
  return dates.map((date, index) => ({
    date,
    weekdayIndex: index,
    active: activeIndexes.includes(index),
    isToday: index === todayIndex,
    isFuture: index > todayIndex,
  }));
}

function mockWeek(week: WeekConsistency | null, overrides: Partial<ReturnType<typeof useWeekConsistencyHook>> = {}) {
  useWeekConsistency.mockReturnValue({
    week,
    loading: false,
    error: null,
    reload: jest.fn(),
    ...overrides,
  });
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('TodayWeekCard', () => {
  it('renders the heading, real streak and the real active-days summary', () => {
    mockStreak({ currentStreak: 5, longestStreak: 8, lastActiveDate: '2026-09-24' });
    mockWeek({
      weekStart: '2026-09-21',
      weekEnd: '2026-09-27',
      activeCount: 3,
      days: buildDays([0, 2, 3], 3),
    });
    render(<TodayWeekCard />);

    expect(screen.getByRole('heading', { name: 'Consistencia Semanal' })).toBeTruthy();
    expect(screen.getByText('🔥 Racha: 5 días')).toBeTruthy();
    expect(screen.getByTestId('current-streak').textContent).toBe('5');
    expect(screen.getByRole('list', { name: 'Días de la semana' })).toBeTruthy();
    expect(screen.getByText(/días activos esta semana/)).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByLabelText('Jueves (hoy, activo)')).toBeTruthy();
  });

  it('uses the singular label for a single active day', () => {
    mockStreak({ currentStreak: 1, longestStreak: 1, lastActiveDate: '2026-09-21' });
    mockWeek({
      weekStart: '2026-09-21',
      weekEnd: '2026-09-27',
      activeCount: 1,
      days: buildDays([0], 0),
    });
    render(<TodayWeekCard />);

    expect(screen.getByText(/día activo esta semana/)).toBeTruthy();
  });

  it('shows an error state with retry when the week fails to load', () => {
    mockStreak({ currentStreak: 0, longestStreak: 0, lastActiveDate: null });
    mockWeek(null, { error: 'No pudimos cargar tu semana. Probá de nuevo en unos minutos.' });
    render(<TodayWeekCard />);

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('never fabricates a weekly plan completion percentage', () => {
    mockStreak({ currentStreak: 0, longestStreak: 0, lastActiveDate: null });
    mockWeek({
      weekStart: '2026-09-21',
      weekEnd: '2026-09-27',
      activeCount: 0,
      days: buildDays([], 3),
    });
    const { container } = render(<TodayWeekCard />);

    expect(container.textContent).not.toMatch(/%/);
    expect(container.textContent).not.toMatch(/\d+\s*(de|\/)\s*5/);
  });
});
