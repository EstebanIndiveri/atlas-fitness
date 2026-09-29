import { afterEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react';

declare const jest: typeof import('@jest/globals').jest;

jest.mock('@/hooks/useHabitAdherence', () => ({
  useHabitAdherence: jest.fn(),
}));

import { useHabitAdherence as useHabitAdherenceHook } from '@/hooks/useHabitAdherence';
import { HABIT_TARGET_COPY } from '@/lib/copy/habit-targets';
import { MetricSourceLabel } from '@/types/metric';
import type { UseHabitAdherenceResult } from '@/hooks/useHabitAdherence';
import type { HabitTargetAdherenceWindow } from '@/types/habit-adherence';
import type { HabitKey } from '@/types/habit';
import type { HabitTargetDayState, HabitTargetWeekday } from '@/types/habit-target';
import { HabitTargetAdherenceHistory } from './HabitTargetAdherenceHistory';

const useHabitAdherence = jest.mocked(useHabitAdherenceHook);

interface DaySeed {
  localDate: string;
  weekday: HabitTargetWeekday;
  isToday: boolean;
  isFuture: boolean;
  states: Partial<Record<HabitKey, HabitTargetDayState>>;
}

const WEEK_SEED: readonly DaySeed[] = [
  { localDate: '2026-09-21', weekday: 1, isToday: false, isFuture: false, states: { walk: 'expected_completed' } },
  { localDate: '2026-09-22', weekday: 2, isToday: false, isFuture: false, states: { hydration: 'extra_recorded' } },
  { localDate: '2026-09-23', weekday: 3, isToday: false, isFuture: false, states: { walk: 'expected_unrecorded' } },
  { localDate: '2026-09-24', weekday: 4, isToday: true, isFuture: false, states: {} },
  { localDate: '2026-09-25', weekday: 5, isToday: false, isFuture: true, states: { sleep: 'future_expected' } },
  { localDate: '2026-09-26', weekday: 6, isToday: false, isFuture: true, states: {} },
  { localDate: '2026-09-27', weekday: 0, isToday: false, isFuture: true, states: {} },
];

function statesFor(seed: DaySeed): Record<HabitKey, HabitTargetDayState> {
  return {
    hydration: seed.states.hydration ?? 'not_expected',
    walk: seed.states.walk ?? 'not_expected',
    mobility: seed.states.mobility ?? 'not_expected',
    sleep: seed.states.sleep ?? 'not_expected',
  };
}

function habitResult(
  overrides: Partial<HabitTargetAdherenceWindow['perHabit']['walk']> = {},
): HabitTargetAdherenceWindow['perHabit']['walk'] {
  return {
    configurationState: 'not_configured',
    metricState: 'no_expected_days',
    expectedHabitDays: 0,
    completedExpectedHabitDays: 0,
    extraRecordedHabitDays: 0,
    adherencePercent: null,
    ...overrides,
  };
}

function resultWindow(
  overrides: Partial<HabitTargetAdherenceWindow> = {},
): HabitTargetAdherenceWindow {
  return {
    period: 'week',
    windowStart: '2026-09-21',
    windowEnd: '2026-09-27',
    today: '2026-09-24',
    configurationState: 'partially_configured',
    metricState: 'result',
    expectedHabitDays: 2,
    completedExpectedHabitDays: 1,
    extraRecordedHabitDays: 1,
    adherencePercent: 50,
    perHabit: {
      hydration: habitResult({ extraRecordedHabitDays: 1 }),
      walk: habitResult({
        configurationState: 'configured',
        metricState: 'result',
        expectedHabitDays: 2,
        completedExpectedHabitDays: 1,
        adherencePercent: 50,
      }),
      mobility: habitResult(),
      sleep: habitResult(),
    },
    days: WEEK_SEED.map((seed) => ({
      localDate: seed.localDate,
      weekday: seed.weekday,
      isToday: seed.isToday,
      isFuture: seed.isFuture,
      habitStates: statesFor(seed),
    })),
    ...overrides,
  };
}

function hookResult(overrides: Partial<UseHabitAdherenceResult> = {}): UseHabitAdherenceResult {
  return {
    adherence: null,
    loading: false,
    error: null,
    reload: jest.fn(),
    ...overrides,
  };
}

describe('HabitTargetAdherenceHistory', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading state without rendering any ratio', () => {
    useHabitAdherence.mockReturnValue(hookResult({ loading: true }));

    render(<HabitTargetAdherenceHistory />);

    expect(screen.getByTestId('habit-target-history-loading').textContent).toBe(
      HABIT_TARGET_COPY.historyLoading,
    );
    expect(screen.queryByTestId('habit-target-history-summary')).toBeNull();
  });

  it('shows the error and retries through the hook', () => {
    const reload = jest.fn();
    useHabitAdherence.mockReturnValue(
      hookResult({ error: HABIT_TARGET_COPY.historyError, reload }),
    );

    render(<HabitTargetAdherenceHistory />);

    expect(screen.getByTestId('habit-target-history-error').textContent).toContain(
      HABIT_TARGET_COPY.historyError,
    );
    fireEvent.click(screen.getByRole('button', { name: HABIT_TARGET_COPY.historyRetry }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders no ratio and no percent when the denominator is zero', () => {
    useHabitAdherence.mockReturnValue(
      hookResult({
        adherence: resultWindow({
          configurationState: 'not_configured',
          metricState: 'no_expected_days',
          expectedHabitDays: 0,
          completedExpectedHabitDays: 0,
          extraRecordedHabitDays: 0,
          adherencePercent: null,
          perHabit: {
            hydration: habitResult(),
            walk: habitResult(),
            mobility: habitResult(),
            sleep: habitResult(),
          },
          days: WEEK_SEED.map((seed) => ({
            localDate: seed.localDate,
            weekday: seed.weekday,
            isToday: seed.isToday,
            isFuture: seed.isFuture,
            habitStates: statesFor(seed),
          })),
        }),
      }),
    );

    render(<HabitTargetAdherenceHistory />);

    expect(screen.getByTestId('habit-target-history-empty').textContent).toBe(
      HABIT_TARGET_COPY.historyEmpty,
    );
    expect(screen.queryByText(/\d+ de \d+ días objetivo/)).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('always shows N de M días objetivo for a result, with the percent as a secondary value', () => {
    useHabitAdherence.mockReturnValue(hookResult({ adherence: resultWindow() }));

    render(<HabitTargetAdherenceHistory />);

    const summary = screen.getByTestId('habit-target-history-summary');
    expect(within(summary).getByText(HABIT_TARGET_COPY.globalCountsLabel(1, 2))).toBeTruthy();
    expect(within(summary).getByText('50%')).toBeTruthy();
    expect(within(summary).getByText(MetricSourceLabel.atlas_computed)).toBeTruthy();
  });

  it('keeps a historical result visible when today has no active target', () => {
    useHabitAdherence.mockReturnValue(
      hookResult({
        adherence: resultWindow({
          configurationState: 'not_configured',
          perHabit: {
            hydration: habitResult(),
            walk: habitResult({
              configurationState: 'not_configured',
              metricState: 'result',
              expectedHabitDays: 2,
              completedExpectedHabitDays: 1,
              adherencePercent: 50,
            }),
            mobility: habitResult(),
            sleep: habitResult(),
          },
        }),
      }),
    );

    render(<HabitTargetAdherenceHistory />);

    expect(screen.getByText(HABIT_TARGET_COPY.historicalResultNote)).toBeTruthy();
    expect(screen.getByText(HABIT_TARGET_COPY.globalCountsLabel(1, 2))).toBeTruthy();
  });

  it('reports per-habit results in catalog order and keeps unconfigured habits honest', () => {
    useHabitAdherence.mockReturnValue(hookResult({ adherence: resultWindow() }));

    render(<HabitTargetAdherenceHistory />);

    const walkRow = screen.getByTestId('habit-target-history-habit-walk');
    expect(
      within(walkRow).getByText(HABIT_TARGET_COPY.habitCountsLabel('Pasos Activos', 1, 2)),
    ).toBeTruthy();

    const mobilityRow = screen.getByTestId('habit-target-history-habit-mobility');
    expect(within(mobilityRow).getByText(HABIT_TARGET_COPY.historyEmptyHabit)).toBeTruthy();
    expect(within(mobilityRow).queryByText(/%/)).toBeNull();

    const hydrationRow = screen.getByTestId('habit-target-history-habit-hydration');
    expect(
      within(hydrationRow).getByText(HABIT_TARGET_COPY.extraRecordedLabel(1)),
    ).toBeTruthy();
  });

  it('renders every daily state honestly, including future and extra records', () => {
    useHabitAdherence.mockReturnValue(hookResult({ adherence: resultWindow() }));

    render(<HabitTargetAdherenceHistory />);

    const label = (date: string, state: keyof typeof HABIT_TARGET_COPY.dayStates) =>
      HABIT_TARGET_COPY.dayStateLabel(date, HABIT_TARGET_COPY.dayStates[state]);

    expect(screen.getByLabelText(label('21/09/2026', 'expected_completed'))).toBeTruthy();
    expect(screen.getByLabelText(label('23/09/2026', 'expected_unrecorded'))).toBeTruthy();
    expect(screen.getByLabelText(label('22/09/2026', 'extra_recorded'))).toBeTruthy();
    expect(screen.getByLabelText(label('25/09/2026', 'future_expected'))).toBeTruthy();
    expect(screen.getAllByLabelText(label('24/09/2026', 'not_expected')).length).toBeGreaterThan(0);
  });

  it('reads the selected period through the hook', () => {
    useHabitAdherence.mockReturnValue(hookResult({ adherence: resultWindow() }));

    render(<HabitTargetAdherenceHistory />);

    expect(useHabitAdherence).toHaveBeenCalledWith('week', 0);
    fireEvent.click(screen.getByRole('radio', { name: HABIT_TARGET_COPY.periods.month }));
    expect(useHabitAdherence).toHaveBeenCalledWith('month', 0);
  });
});
