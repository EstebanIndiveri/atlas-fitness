/** @jest-environment jsdom */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { PROGRESS_COPY } from '@/lib/copy/progress';
import { TODAY_COPY } from '@/lib/copy/today';
import type { HabitTargetAdherenceWindow } from '@/types/habit-adherence';
import { HabitTargetAdherenceCard } from './HabitTargetAdherenceCard';

const RATIO_PATTERN = /\d+\s+de\s+\d+\s+días objetivo/;

function adherenceWindow(
  overrides: Partial<HabitTargetAdherenceWindow> = {},
): HabitTargetAdherenceWindow {
  return {
    period: 'month',
    windowStart: '2026-09-01',
    windowEnd: '2026-09-30',
    today: '2026-09-24',
    configurationState: 'configured',
    metricState: 'result',
    expectedHabitDays: 8,
    completedExpectedHabitDays: 6,
    extraRecordedHabitDays: 1,
    adherencePercent: 75,
    perHabit: {
      hydration: {
        configurationState: 'configured',
        metricState: 'result',
        expectedHabitDays: 2,
        completedExpectedHabitDays: 2,
        extraRecordedHabitDays: 1,
        adherencePercent: 100,
      },
      walk: {
        configurationState: 'configured',
        metricState: 'result',
        expectedHabitDays: 2,
        completedExpectedHabitDays: 1,
        extraRecordedHabitDays: 0,
        adherencePercent: 50,
      },
      mobility: {
        configurationState: 'configured',
        metricState: 'result',
        expectedHabitDays: 2,
        completedExpectedHabitDays: 2,
        extraRecordedHabitDays: 0,
        adherencePercent: 100,
      },
      sleep: {
        configurationState: 'configured',
        metricState: 'result',
        expectedHabitDays: 2,
        completedExpectedHabitDays: 1,
        extraRecordedHabitDays: 0,
        adherencePercent: 50,
      },
    },
    days: [],
    ...overrides,
  };
}

function noExpectedWindow(
  configurationState: HabitTargetAdherenceWindow['configurationState'],
): HabitTargetAdherenceWindow {
  return adherenceWindow({
    configurationState,
    metricState: 'no_expected_days',
    expectedHabitDays: 0,
    completedExpectedHabitDays: 0,
    extraRecordedHabitDays: 0,
    adherencePercent: null,
    perHabit: {
      hydration: {
        configurationState: 'not_configured',
        metricState: 'no_expected_days',
        expectedHabitDays: 0,
        completedExpectedHabitDays: 0,
        extraRecordedHabitDays: 0,
        adherencePercent: null,
      },
      walk: {
        configurationState: 'not_configured',
        metricState: 'no_expected_days',
        expectedHabitDays: 0,
        completedExpectedHabitDays: 0,
        extraRecordedHabitDays: 0,
        adherencePercent: null,
      },
      mobility: {
        configurationState: 'not_configured',
        metricState: 'no_expected_days',
        expectedHabitDays: 0,
        completedExpectedHabitDays: 0,
        extraRecordedHabitDays: 0,
        adherencePercent: null,
      },
      sleep: {
        configurationState: 'not_configured',
        metricState: 'no_expected_days',
        expectedHabitDays: 0,
        completedExpectedHabitDays: 0,
        extraRecordedHabitDays: 0,
        adherencePercent: null,
      },
    },
  });
}

function renderCard(props: {
  adherence: HabitTargetAdherenceWindow | null;
  loading: boolean;
  error: string | null;
}) {
  return render(<HabitTargetAdherenceCard {...props} />);
}

describe('HabitTargetAdherenceCard', () => {
  it('renders loading without any ratio, percentage or empty default', () => {
    renderCard({ adherence: null, loading: true, error: null });

    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText(PROGRESS_COPY.habitTarget.loading)).toBeTruthy();
    expect(screen.queryByText('Calculado por Atlas')).toBeNull();
    expect(screen.queryByText(RATIO_PATTERN)).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('renders an explicit unavailable state, including the expired-session copy', () => {
    const { unmount } = renderCard({
      adherence: null,
      loading: false,
      error: PROGRESS_COPY.habitTarget.unavailable,
    });

    expect(screen.getByRole('alert').textContent).toBe(
      PROGRESS_COPY.habitTarget.unavailable,
    );
    expect(screen.queryByText(RATIO_PATTERN)).toBeNull();
    expect(screen.queryByText('Calculado por Atlas')).toBeNull();
    unmount();

    renderCard({
      adherence: null,
      loading: false,
      error: TODAY_COPY.habitsSessionExpired,
    });

    expect(screen.getByRole('alert').textContent).toBe(
      TODAY_COPY.habitsSessionExpired,
    );
  });

  it('always renders the N de M counts with provenance and lets the percentage accompany them for a result', () => {
    renderCard({ adherence: adherenceWindow(), loading: false, error: null });

    expect(
      screen.getByRole('heading', { name: PROGRESS_COPY.habitTarget.title }),
    ).toBeTruthy();
    expect(screen.getByText('6 de 8 días objetivo')).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText('Calculado por Atlas')).toBeTruthy();
    expect(screen.getByText(PROGRESS_COPY.habitTarget.provenance)).toBeTruthy();
    expect(
      screen.getByText(
        PROGRESS_COPY.habitTarget.windowLabel('01/09/2026', '30/09/2026'),
      ),
    ).toBeTruthy();
  });

  it('shows a historical result even when no target is active today', () => {
    renderCard({
      adherence: adherenceWindow({ configurationState: 'not_configured' }),
      loading: false,
      error: null,
    });

    expect(screen.getByText('6 de 8 días objetivo')).toBeTruthy();
    expect(screen.getByText(PROGRESS_COPY.habitTarget.historicalInactive)).toBeTruthy();
    expect(
      screen.queryByText(PROGRESS_COPY.habitTarget.notConfiguredTitle),
    ).toBeNull();
  });

  it('names "no elapsed objective day" for a configured target with denominator zero and never renders a ratio', () => {
    const { container } = renderCard({
      adherence: noExpectedWindow('configured'),
      loading: false,
      error: null,
    });

    expect(
      screen.getByRole('heading', { name: PROGRESS_COPY.habitTarget.noExpectedTitle }),
    ).toBeTruthy();
    expect(screen.getByText(PROGRESS_COPY.habitTarget.noExpectedBody)).toBeTruthy();
    expect(screen.getByText(PROGRESS_COPY.habitTarget.configuredLabel)).toBeTruthy();
    expect(RATIO_PATTERN.test(container.textContent ?? '')).toBe(false);
    expect(container.textContent ?? '').not.toMatch(/%|NaN/);
  });

  it('invites configuration when no target exists and never renders a ratio', () => {
    const { container } = renderCard({
      adherence: noExpectedWindow('not_configured'),
      loading: false,
      error: null,
    });

    expect(
      screen.getByRole('heading', { name: PROGRESS_COPY.habitTarget.notConfiguredTitle }),
    ).toBeTruthy();
    expect(screen.getByText(PROGRESS_COPY.habitTarget.notConfiguredBody)).toBeTruthy();
    expect(RATIO_PATTERN.test(container.textContent ?? '')).toBe(false);
    expect(container.textContent ?? '').not.toMatch(/%|NaN/);
  });

  it('keeps extra recorded days explicit without altering the N de M counts', () => {
    renderCard({
      adherence: adherenceWindow({
        expectedHabitDays: 6,
        completedExpectedHabitDays: 2,
        extraRecordedHabitDays: 3,
        adherencePercent: 33,
      }),
      loading: false,
      error: null,
    });

    expect(screen.getByText('2 de 6 días objetivo')).toBeTruthy();
    expect(screen.getByText(PROGRESS_COPY.habitTarget.extraLabel(3))).toBeTruthy();
  });

  it('does not expose the previous window while another period is loading', () => {
    const { rerender } = renderCard({
      adherence: adherenceWindow(),
      loading: false,
      error: null,
    });

    expect(screen.getByText('6 de 8 días objetivo')).toBeTruthy();

    rerender(<HabitTargetAdherenceCard adherence={adherenceWindow()} loading error={null} />);

    expect(screen.queryByText('6 de 8 días objetivo')).toBeNull();
    expect(screen.getByText(PROGRESS_COPY.habitTarget.loading)).toBeTruthy();
  });
});
