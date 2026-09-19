import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { StreakChip, StreakChipView } from './StreakChip';
import { STREAK_COPY } from '@/lib/copy/streak';
import type { StreakStats } from '@/types/streak';

jest.mock('@/hooks/useStreak', () => ({
  useStreak: jest.fn(),
}));

import { useStreak } from '@/hooks/useStreak';

const mockedUseStreak = jest.mocked(useStreak);

function stats(overrides: Partial<StreakStats> = {}): StreakStats {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    ...overrides,
  };
}

describe('StreakChipView', () => {
  it('keeps numeric test ids and motivating zero-state copy', () => {
    render(<StreakChipView streak={stats()} />);

    expect(screen.getByTestId('streak-chip')).toBeTruthy();
    expect(screen.getByTestId('current-streak').textContent).toBe('0');
    expect(screen.getByTestId('longest-streak').textContent).toBe('0');
    expect(screen.getByText(STREAK_COPY.zeroTitle, { exact: false })).toBeTruthy();
    expect(screen.getByText(STREAK_COPY.zeroBody)).toBeTruthy();
    expect(screen.queryByText(STREAK_COPY.recordBadge)).toBeNull();
  });

  it('celebrates a record streak without dropping test ids', () => {
    render(<StreakChipView streak={stats({ currentStreak: 4, longestStreak: 4 })} />);

    expect(screen.getByTestId('current-streak').textContent).toBe('4');
    expect(screen.getByTestId('longest-streak').textContent).toBe('4');
    expect(screen.getByText(STREAK_COPY.recordBadge)).toBeTruthy();
    expect(screen.getByText(STREAK_COPY.recordBody)).toBeTruthy();
    expect(screen.getByTestId('streak-chip').getAttribute('aria-label')).toContain('4 días');
  });
});

describe('StreakChip', () => {
  it('announces loading', () => {
    mockedUseStreak.mockReturnValue({
      streak: null,
      loading: true,
      error: null,
      reload: jest.fn(async () => undefined),
    });

    render(<StreakChip />);
    expect(screen.getByTestId('streak-chip').getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toContain(STREAK_COPY.loading);
  });

  it('offers a keyboard-accessible retry on error', () => {
    const reload = jest.fn(async () => undefined);
    mockedUseStreak.mockReturnValue({
      streak: null,
      loading: false,
      error: STREAK_COPY.error,
      reload,
    });

    render(<StreakChip />);
    expect(screen.getByRole('alert').textContent).toContain(STREAK_COPY.error);
    fireEvent.click(screen.getByTestId('streak-retry'));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: STREAK_COPY.retry })).toBeTruthy();
  });
});
