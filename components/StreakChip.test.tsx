import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StreakChip, StreakChipView } from './StreakChip';
import { STREAK_COPY } from '@/lib/copy/streak';
import type { StreakStats } from '@/types/streak';

function stats(overrides: Partial<StreakStats> = {}): StreakStats {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    ...overrides,
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
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
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('announces loading', () => {
    global.fetch = jest.fn(() => new Promise<Response>(() => undefined)) as unknown as typeof fetch;

    render(<StreakChip />);
    expect(screen.getByTestId('streak-chip').getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toContain(STREAK_COPY.loading);
  });

  it('offers a keyboard-accessible retry on error', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, false, 500))
      .mockResolvedValueOnce(jsonResponse({ currentStreak: 0, longestStreak: 1, lastActiveDate: null }));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<StreakChip />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(STREAK_COPY.error);
    });

    const retry = screen.getByRole('button', { name: STREAK_COPY.retry });
    expect(retry).toBeTruthy();
    fireEvent.click(retry);
    await waitFor(() => {
      expect(screen.getByTestId('current-streak').textContent).toBe('0');
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
