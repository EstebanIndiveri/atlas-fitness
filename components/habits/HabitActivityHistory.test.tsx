import { afterEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react';

declare const jest: typeof import('@jest/globals').jest;

jest.mock('@/hooks/useHabitActivity', () => ({
  useHabitActivity: jest.fn(),
}));

import { HabitActivityHistory } from '@/components/habits/HabitActivityHistory';
import type { UseHabitActivityResult } from '@/hooks/useHabitActivity';
import { useHabitActivity as useHabitActivityHook } from '@/hooks/useHabitActivity';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import { INSIGHT_MINIMUM_ELAPSED_DAYS } from '@/types/habit-activity';
import type {
  HabitActivityDay,
  HabitActivityPeriod,
  HabitActivityWindow,
} from '@/types/habit-activity';
import type { HabitKey } from '@/types/habit';

const useHabitActivity = jest.mocked(useHabitActivityHook);

/** Sunday 2026-09-27 in Córdoba: the reference day every window in this file ends on. */
const TODAY = '2026-09-27';
const WINDOW_LENGTH: Record<HabitActivityPeriod, number> = {
  week: 7,
  month: 30,
  quarter: 90,
};
const HABIT_KEYS: readonly HabitKey[] = ['hydration', 'walk', 'mobility', 'sleep'];

const FORBIDDEN_VOCABULARY =
  /adherencia|cumplimiento|meta|objetivo|porcentaje|%|racha|logro|nivel|puntos|puntaje|score|fallad[oa]|incumplid[oa]|perdid[oa]|omitid[oa]/i;

function addDays(localDate: string, days: number): string {
  const base = new Date(`${localDate}T12:00:00.000-03:00`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

interface DaySpec {
  readonly recorded?: boolean;
  readonly today?: boolean;
  readonly future?: boolean;
}

interface WindowOverrides {
  readonly activeDays?: number;
  readonly insightStatus?: HabitActivityWindow['insightStatus'];
  readonly elapsedDays?: number;
}

function makeWindow(
  period: HabitActivityPeriod,
  specs: readonly DaySpec[],
  overrides: WindowOverrides = {},
): HabitActivityWindow {
  const length = WINDOW_LENGTH[period];
  const start = addDays(TODAY, -(length - 1));
  const fullSpecs: readonly DaySpec[] = Array.from({ length }, (_, index) => specs[index] ?? {});

  const days: HabitActivityDay[] = fullSpecs.map((spec, index) => {
    const recordedKeys: HabitKey[] = [];
    if (spec.recorded) {
      recordedKeys.push('hydration');
    }
    return {
      localDate: addDays(start, index),
      weekdayIndex: index % 7,
      isToday: spec.today === true,
      isFuture: spec.future === true,
      recordedKeys,
      isRecorded: recordedKeys.length > 0,
    };
  });

  const observedDays = days.filter((day) => day.isRecorded);
  const elapsedDays = overrides.elapsedDays ?? days.filter((day) => !day.isFuture).length;
  const activeDays = overrides.activeDays ?? observedDays.length;

  return {
    period,
    windowStart: days[0].localDate,
    windowEnd: days[days.length - 1].localDate,
    elapsedDays,
    activeDays,
    perHabit: {
      hydration: { activeDays: observedDays.length },
      walk: { activeDays: 0 },
      mobility: { activeDays: 0 },
      sleep: { activeDays: 0 },
    },
    days,
    insightStatus:
      overrides.insightStatus ??
      (elapsedDays < INSIGHT_MINIMUM_ELAPSED_DAYS || activeDays === 0 ? 'insufficient' : 'available'),
    insightMinimumElapsedDays: INSIGHT_MINIMUM_ELAPSED_DAYS,
  };
}

function mockActivity(overrides: Partial<UseHabitActivityResult> = {}): void {
  useHabitActivity.mockReturnValue({
    activity: null,
    loading: false,
    error: null,
    reload: jest.fn(),
    ...overrides,
  });
}
describe('HabitActivityHistory', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading state without presenting zero counts as recorded activity', () => {
    mockActivity({ loading: true });

    render(<HabitActivityHistory />);

    expect(screen.getByTestId('habit-activity-history')).toBeTruthy();
    expect(screen.getByTestId('habit-activity-history-loading')).toBeTruthy();
    expect(screen.queryByTestId('habit-activity-strips')).toBeNull();
    expect(screen.queryByText(PROGRESS_COPY.habitActivity.recordedDaysLabel('Hidratación', 0, 7))).toBeNull();
  });

  it('never opens a second page-level live region or a second retry control', () => {
    mockActivity({ loading: true });

    const { unmount } = render(<HabitActivityHistory />);

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();

    unmount();
    mockActivity({ error: PROGRESS_COPY.habitActivity.unavailable });

    render(<HabitActivityHistory />);

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('shows the hook failure instead of empty defaults', () => {
    mockActivity({ error: PROGRESS_COPY.habitActivity.unavailable });

    render(<HabitActivityHistory />);

    expect(screen.getByTestId('habit-activity-history-error').textContent).toContain(
      PROGRESS_COPY.habitActivity.unavailable,
    );
    expect(screen.queryByTestId('habit-activity-strips')).toBeNull();
    expect(screen.queryByTestId('habit-activity-insufficient')).toBeNull();
  });

  it('treats a window that is still too young as insufficient and names the threshold', () => {
    mockActivity({
      activity: makeWindow(
        'week',
        Array.from({ length: 7 }, (_, index) =>
          index === 0 ? { recorded: true, today: true } : { future: true },
        ),
      ),
    });

    render(<HabitActivityHistory />);

    expect(screen.getByTestId('habit-activity-insufficient')).toBeTruthy();
    expect(screen.getByText(PROGRESS_COPY.habitActivity.historyTitle)).toBeTruthy();
    expect(screen.getByText(PROGRESS_COPY.habitActivity.insufficientTitle)).toBeTruthy();
    expect(
      screen.getByText(
        PROGRESS_COPY.habitActivity.insufficientElapsed(1, INSIGHT_MINIMUM_ELAPSED_DAYS),
      ),
    ).toBeTruthy();
    expect(screen.queryByText(PROGRESS_COPY.habitActivity.insufficientNoActivity)).toBeNull();
    expect(
      screen.getByText(PROGRESS_COPY.habitActivity.windowLabel('21/09/2026', '27/09/2026')),
    ).toBeTruthy();
    expect(
      screen.getByText(PROGRESS_COPY.habitActivity.todayIsLabel('21/09/2026')),
    ).toBeTruthy();
    expect(screen.queryByText(PROGRESS_COPY.habitActivity.summary(1, 1))).toBeNull();

    const hydrationStrip = screen.getByLabelText(
      PROGRESS_COPY.habitActivity.dayStripAria('Hidratación'),
    );

    expect(
      within(hydrationStrip).getByLabelText(PROGRESS_COPY.habitActivity.dayRecorded('21/09/2026')),
    ).toBeTruthy();
    expect(
      within(hydrationStrip).getByLabelText(PROGRESS_COPY.habitActivity.dayFuture('22/09/2026')),
    ).toBeTruthy();
    expect(screen.queryByText('Calculado por Atlas')).toBeNull();
  });

  it('renders stored rows with zero activity as days sin registro, never as measured zeroes', () => {
    mockActivity({
      activity: makeWindow(
        'month',
        Array.from({ length: 30 }, (_, index) => ({ today: index === 29 })),
        { elapsedDays: 30, activeDays: 0 },
      ),
    });

    render(<HabitActivityHistory />);

    expect(screen.getByText(PROGRESS_COPY.habitActivity.insufficientNoActivity)).toBeTruthy();
    expect(
      screen.queryByText(
        PROGRESS_COPY.habitActivity.insufficientElapsed(30, INSIGHT_MINIMUM_ELAPSED_DAYS),
      ),
    ).toBeNull();
    expect(screen.queryByText(PROGRESS_COPY.habitActivity.summary(0, 30))).toBeNull();
    expect(screen.queryByText('Calculado por Atlas')).toBeNull();

    const hydrationStrip = screen.getByLabelText(
      PROGRESS_COPY.habitActivity.dayStripAria('Hidratación'),
    );
    const labels = within(hydrationStrip)
      .getAllByRole('listitem')
      .map((mark) => mark.getAttribute('aria-label') ?? '');

    expect(labels).toHaveLength(30);
    expect(labels[0]).toBe(PROGRESS_COPY.habitActivity.dayMissing('29/08/2026'));
    expect(labels[29]).toBe(PROGRESS_COPY.habitActivity.dayMissing('27/09/2026'));
    expect(labels.every((label) => label.endsWith(': sin registro'))).toBe(true);
    expect(labels.join(' ')).not.toMatch(FORBIDDEN_VOCABULARY);
  });

  it('dates every mark, labels the weekday Monday-first and marks missing days as sin registro', () => {
    mockActivity({
      activity: makeWindow('week', [
        { recorded: true },
        { recorded: true },
        {},
        {},
        {},
        {},
        { today: true },
      ]),
    });

    render(<HabitActivityHistory />);

    const strip = screen.getByLabelText(PROGRESS_COPY.habitActivity.dayStripAria('Hidratación'));
    const marks = within(strip).getAllByRole('listitem');

    expect(marks).toHaveLength(7);
    expect(marks.map((mark) => mark.textContent)).toEqual([
      'L21',
      'M22',
      'M23',
      'J24',
      'V25',
      'S26',
      'D27',
    ]);
    expect(marks[0].getAttribute('aria-label')).toBe(
      PROGRESS_COPY.habitActivity.dayRecorded('21/09/2026'),
    );
    expect(marks[2].getAttribute('aria-label')).toBe(
      PROGRESS_COPY.habitActivity.dayMissing('23/09/2026'),
    );
  });
  it('renders an available window with its caption, count pair and one strip per catalog habit', () => {
    mockActivity({
      activity: makeWindow('month', [
        { recorded: true },
        { recorded: true },
        { recorded: true },
        { today: true },
      ]),
    });

    render(<HabitActivityHistory />);

    expect(screen.getByText(PROGRESS_COPY.habitActivity.summary(3, 30))).toBeTruthy();
    expect(screen.getByText(PROGRESS_COPY.habitActivity.windowLabel('29/08/2026', '27/09/2026'))).toBeTruthy();
    expect(screen.getByText(PROGRESS_COPY.habitActivity.todayIsLabel('01/09/2026'))).toBeTruthy();
    expect(screen.queryByTestId('habit-activity-insufficient')).toBeNull();

    const strips = within(screen.getByTestId('habit-activity-strips')).getAllByRole('list');
    expect(strips).toHaveLength(HABIT_KEYS.length);

    const hydrationDays = screen.getByText(
      PROGRESS_COPY.habitActivity.recordedDaysLabel('Hidratación', 3, 30),
    );
    expect(hydrationDays.parentElement?.textContent).toContain('Calculado por Atlas');
    expect(
      screen.getByText(PROGRESS_COPY.habitActivity.recordedDaysLabel('Movilidad', 0, 30)),
    ).toBeTruthy();
    expect(screen.getAllByText('Calculado por Atlas')).toHaveLength(HABIT_KEYS.length);
  });

  it('renders a future day as still-to-come and never as a day without a record', () => {
    mockActivity({
      activity: makeWindow(
        'month',
        Array.from({ length: 30 }, (_, index) => ({
          recorded: index === 0,
          today: index === 24,
          future: index > 24,
        })),
      ),
    });

    render(<HabitActivityHistory />);

    const strip = screen.getByLabelText(PROGRESS_COPY.habitActivity.dayStripAria('Hidratación'));
    const marks = within(strip).getAllByRole('listitem');

    expect(screen.getByText(PROGRESS_COPY.habitActivity.summary(1, 25))).toBeTruthy();
    expect(marks[24].getAttribute('aria-label')).toBe(
      PROGRESS_COPY.habitActivity.dayMissing('22/09/2026'),
    );
    expect(marks[25].getAttribute('aria-label')).toBe(
      PROGRESS_COPY.habitActivity.dayFuture('23/09/2026'),
    );
    expect(marks[25].getAttribute('aria-label')).not.toContain('sin registro');
  });

  it('never renders forbidden vocabulary in the activity text or its accessible names', () => {
    mockActivity({
      activity: makeWindow('month', [
        { recorded: true },
        { today: true },
      ]),
    });

    const { container } = render(<HabitActivityHistory />);

    const accessibleNames = Array.from(container.querySelectorAll('[aria-label]')).map(
      (element) => element.getAttribute('aria-label') ?? '',
    );
    const rendered = [screen.getByTestId('habit-activity-history').textContent ?? '', ...accessibleNames];

    expect(accessibleNames).toHaveLength(1 + HABIT_KEYS.length * (1 + WINDOW_LENGTH.month));
    expect(rendered.join(' ')).not.toMatch(FORBIDDEN_VOCABULARY);
  });

  it('switches the window through the period control and re-renders the new period', () => {
    useHabitActivity.mockImplementation((period) => ({
      activity:
        period === 'quarter'
          ? makeWindow('quarter', Array.from({ length: 90 }, (_, index) => ({
              recorded: index < 10,
              today: index === 89,
            })))
          : makeWindow('week', [{ recorded: true }, { today: true }]),
      loading: false,
      error: null,
      reload: jest.fn(),
    }));

    render(<HabitActivityHistory />);

    expect(
      screen.getByRole('radiogroup', { name: PROGRESS_COPY.habitActivity.periodAria }),
    ).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Semana' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(PROGRESS_COPY.habitActivity.summary(1, 7))).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: '3 meses' }));

    expect(useHabitActivity).toHaveBeenLastCalledWith('quarter');
    expect(screen.getByRole('radio', { name: '3 meses' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(PROGRESS_COPY.habitActivity.summary(10, 90))).toBeTruthy();
    expect(screen.queryByText(PROGRESS_COPY.habitActivity.summary(1, 7))).toBeNull();
  });
});


