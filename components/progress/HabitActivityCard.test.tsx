/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import { TODAY_COPY } from '@/lib/copy/today';
import type {
  HabitActivityDay,
  HabitActivityWindow,
} from '@/types/habit-activity';
import { HabitActivityCard } from './HabitActivityCard';

const FORBIDDEN_VOCABULARY =
  /adherencia|cumplimiento|consisten|meta|objetivo|porcentaje|%|racha|logro|nivel|puntos|puntaje|score|fallad[oa]|incumplid[oa]|perdid[oa]|omitid[oa]/i;

function day(
  localDate: string,
  weekdayIndex: number,
  overrides: Partial<HabitActivityDay> = {},
): HabitActivityDay {
  return {
    localDate,
    weekdayIndex,
    isToday: false,
    isFuture: false,
    recordedKeys: [],
    isRecorded: false,
    ...overrides,
  };
}

const WEEK_DAYS: HabitActivityDay[] = [
  day('2026-09-21', 0, {
    recordedKeys: ['hydration', 'mobility'],
    isRecorded: true,
  }),
  day('2026-09-22', 1),
  day('2026-09-23', 2, { recordedKeys: ['hydration'], isRecorded: true }),
  day('2026-09-24', 3, { recordedKeys: ['walk'], isRecorded: true, isToday: true }),
  day('2026-09-25', 4, { isFuture: true }),
  day('2026-09-26', 5, { isFuture: true }),
  day('2026-09-27', 6, { isFuture: true }),
];

function window(
  overrides: Partial<HabitActivityWindow> = {},
): HabitActivityWindow {
  return {
    period: 'week',
    windowStart: '2026-09-21',
    windowEnd: '2026-09-27',
    elapsedDays: 4,
    activeDays: 3,
    perHabit: {
      hydration: { activeDays: 2 },
      walk: { activeDays: 1 },
      mobility: { activeDays: 1 },
      sleep: { activeDays: 0 },
    },
    days: WEEK_DAYS,
    insightStatus: 'available',
    insightMinimumElapsedDays: 7,
    ...overrides,
  };
}

function renderCard(props: {
  activity: HabitActivityWindow | null;
  loading: boolean;
  error: string | null;
}) {
  return render(<HabitActivityCard {...props} />);
}

function renderedText(container: HTMLElement): string {
  const labels = Array.from(container.querySelectorAll('[aria-label]')).map(
    (element) => element.getAttribute('aria-label') ?? '',
  );
  return `${container.textContent ?? ''} ${labels.join(' ')}`;
}

describe('HabitActivityCard', () => {
  it('renders the recorded-day count and the elapsed-day denominator with their declared source', () => {
    renderCard({ activity: window(), loading: false, error: null });

    expect(
      screen.getByRole('heading', { name: PROGRESS_COPY.habitActivity.title }),
    ).toBeDefined();
    expect(
      screen.getByText(PROGRESS_COPY.habitActivity.summary(3, 4)),
    ).toBeDefined();
    expect(
      screen.getByText(PROGRESS_COPY.habitActivity.activeDaysLabel),
    ).toBeDefined();
    expect(
      screen.getByText(PROGRESS_COPY.habitActivity.elapsedDaysLabel),
    ).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getAllByText('Calculado por Atlas')).toHaveLength(2);
  });

  it('states the window it covers, taken from the payload, so the counts cannot be read as another period', () => {
    const { unmount } = renderCard({
      activity: window(),
      loading: false,
      error: null,
    });

    expect(
      screen.getByText(
        PROGRESS_COPY.habitActivity.windowLabel('21/09/2026', '27/09/2026'),
      ),
    ).toBeDefined();
    unmount();

    renderCard({
      activity: window({
        period: 'month',
        windowStart: '2026-08-29',
        windowEnd: '2026-09-27',
        elapsedDays: 30,
        activeDays: 9,
      }),
      loading: false,
      error: null,
    });

    expect(
      screen.getByText(
        PROGRESS_COPY.habitActivity.windowLabel('29/08/2026', '27/09/2026'),
      ),
    ).toBeDefined();
    expect(
      screen.queryByText(
        PROGRESS_COPY.habitActivity.windowLabel('21/09/2026', '27/09/2026'),
      ),
    ).toBeNull();
  });

  it('names the missing-history threshold from the payload instead of rendering a zero measurement', () => {
    renderCard({
      activity: window({
        elapsedDays: 4,
        activeDays: 0,
        insightStatus: 'insufficient',
        insightMinimumElapsedDays: 14,
      }),
      loading: false,
      error: null,
    });

    expect(
      screen.getByText(PROGRESS_COPY.habitActivity.insufficientElapsed(4, 14)),
    ).toBeDefined();
    expect(
      screen.getByText(PROGRESS_COPY.habitActivity.elapsedDaysLabel),
    ).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
    expect(
      screen.queryByText(PROGRESS_COPY.habitActivity.activeDaysLabel),
    ).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText('Calculado por Atlas')).toBeNull();
  });

  it('names missing activity, not missing history, when a full window holds no recorded day', () => {
    renderCard({
      activity: window({
        elapsedDays: 30,
        activeDays: 0,
        insightStatus: 'insufficient',
      }),
      loading: false,
      error: null,
    });

    expect(
      screen.getByText(PROGRESS_COPY.habitActivity.insufficientNoActivity),
    ).toBeDefined();
    expect(
      screen.queryByText(PROGRESS_COPY.habitActivity.insufficientElapsed(30, 7)),
    ).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('keeps the forbidden vocabulary out of the rendered output in both the available and the insufficient state', () => {
    const available = renderCard({
      activity: window(),
      loading: false,
      error: null,
    });
    expect(renderedText(available.container)).not.toMatch(FORBIDDEN_VOCABULARY);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      PROGRESS_COPY.habitActivity.title,
    );
    available.unmount();

    const insufficient = renderCard({
      activity: window({
        elapsedDays: 2,
        activeDays: 0,
        insightStatus: 'insufficient',
      }),
      loading: false,
      error: null,
    });
    expect(renderedText(insufficient.container)).not.toMatch(
      FORBIDDEN_VOCABULARY,
    );
    expect(renderedText(insufficient.container)).toMatch(
      /no hay suficiente período/i,
    );
  });

  it('renders an explicit unavailable state, including the expired-session copy, without empty defaults', () => {
    const { unmount } = renderCard({
      activity: null,
      loading: false,
      error: PROGRESS_COPY.habitActivity.unavailable,
    });

    expect(screen.getByRole('alert').textContent).toBe(
      PROGRESS_COPY.habitActivity.unavailable,
    );
    expect(
      screen.queryByText(PROGRESS_COPY.habitActivity.summary(0, 0)),
    ).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText('Calculado por Atlas')).toBeNull();
    unmount();

    renderCard({
      activity: null,
      loading: false,
      error: TODAY_COPY.habitsSessionExpired,
    });

    expect(screen.getByRole('alert').textContent).toBe(
      TODAY_COPY.habitsSessionExpired,
    );
  });

  it('renders a loading state with no zeroes and no empty default data', () => {
    renderCard({ activity: null, loading: true, error: null });

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText(PROGRESS_COPY.habitActivity.loading)).toBeDefined();
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText('Calculado por Atlas')).toBeNull();
  });

  it('does not show the previous window counts while another period is loading', () => {
    const { rerender } = renderCard({
      activity: window(),
      loading: false,
      error: null,
    });

    expect(screen.getByText('3')).toBeDefined();

    rerender(
      <HabitActivityCard activity={window()} loading error={null} />,
    );

    expect(screen.queryByText('3')).toBeNull();
    expect(screen.queryByText(PROGRESS_COPY.habitActivity.summary(3, 4))).toBeNull();
    expect(screen.getByText(PROGRESS_COPY.habitActivity.loading)).toBeDefined();
  });
});


