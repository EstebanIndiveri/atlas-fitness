import { afterEach, describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import type { StreakStats } from '@/types/streak';

declare const jest: typeof import('@jest/globals').jest;

jest.mock('@/hooks/useStreak', () => ({
  useStreak: jest.fn(),
}));

import { useStreak as useStreakHook } from '@/hooks/useStreak';
import { TodayWeekCard } from './TodayWeekCard';

const useStreak = jest.mocked(useStreakHook);

function mockStreak(streak: StreakStats | null, overrides: Partial<ReturnType<typeof useStreakHook>> = {}) {
  useStreak.mockReturnValue({
    streak,
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
  it('renders the heading, real streak and an honest plan empty state', () => {
    mockStreak({ currentStreak: 5, longestStreak: 8, lastActiveDate: '2026-09-24' });
    render(<TodayWeekCard />);
    expect(screen.getByRole('heading', { name: 'Esta semana' })).toBeTruthy();
    expect(screen.getByTestId('current-streak').textContent).toBe('5');
    expect(screen.getByText('Progreso semanal en camino')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Días de la semana' })).toBeTruthy();
  });

  it('never fabricates a weekly plan completion percentage', () => {
    mockStreak({ currentStreak: 0, longestStreak: 0, lastActiveDate: null });
    const { container } = render(<TodayWeekCard />);
    expect(container.textContent).not.toMatch(/%/);
    expect(container.textContent).not.toMatch(/\d+\s*de\s*\d+\s*completados/);
  });
});
