'use client';

import type { JSX } from 'react';
import { useState } from 'react';

import { HabitStripList, StateLegend, WindowCaption } from '@/components/habits/habit-activity-marks';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useHabitActivity } from '@/hooks/useHabitActivity';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import type { HabitActivityPeriod, HabitActivityWindow } from '@/types/habit-activity';

const COPY = PROGRESS_COPY.habitActivity;

const PERIOD_OPTIONS = [
  { value: 'week', label: PROGRESS_COPY.periods.week },
  { value: 'month', label: PROGRESS_COPY.periods.month },
  { value: 'quarter', label: PROGRESS_COPY.periods.quarter },
] as const;

function isHabitActivityPeriod(value: string): value is HabitActivityPeriod {
  return PERIOD_OPTIONS.some((option) => option.value === value);
}

interface HabitActivityHistoryBodyProps {
  activity: HabitActivityWindow | null;
  error: string | null;
}

function HabitActivityHistoryBody({
  activity,
  error,
}: HabitActivityHistoryBodyProps): JSX.Element {
  if (error !== null) {
    return (
      <p data-testid="habit-activity-history-error" className="text-sm leading-relaxed text-ink-muted">
        {error}
      </p>
    );
  }

  if (activity === null) {
    return (
      <p
        data-testid="habit-activity-history-loading"
        className="text-sm leading-relaxed text-ink-muted"
      >
        {COPY.loading}
      </p>
    );
  }

  if (activity.insightStatus !== 'available') {
    const belowThreshold = activity.elapsedDays < activity.insightMinimumElapsedDays;

    return (
      <div data-testid="habit-activity-insufficient" className="min-w-0 space-y-2">
        <h3 className="font-semibold text-ink">{COPY.insufficientTitle}</h3>
        {belowThreshold && (
          <p className="text-sm leading-relaxed text-ink-muted">
            {COPY.insufficientElapsed(activity.elapsedDays, activity.insightMinimumElapsedDays)}
          </p>
        )}
        {activity.activeDays === 0 && (
          <p className="text-sm leading-relaxed text-ink-muted">{COPY.insufficientNoActivity}</p>
        )}
        <WindowCaption activity={activity} />
        <StateLegend />
        <HabitStripList activity={activity} showRecordedDays={false} />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="min-w-0 space-y-1">
        <p className="text-sm leading-relaxed text-ink-muted">
          {COPY.summary(activity.activeDays, activity.elapsedDays)}
        </p>
        <WindowCaption activity={activity} />
      </div>
      <StateLegend />
      <HabitStripList activity={activity} showRecordedDays />
    </div>
  );
}

/**
 * Read-only record of the habit activity of the current Córdoba week, month or quarter.
 *
 * Renders beside today's manual habit controls so a reader can see which days of the
 * window actually carry a record. A day without a record is named `sin registro` — never
 * as a failed or missed day — and a day that has not arrived yet is named `todavía no llegó`,
 * so no future day is ever presented as a missing one.
 *
 * The block owns no page-level live region and no retry control: {@link HabitsScreen} keeps
 * those, so this record can fail on its own without replacing today's data. Interactive
 * descendants, headings and day markers here are deliberately not inside `habits-list`.
 *
 * @returns The period selector plus the loading, error, insufficient or available record.
 * @example
 * <HabitActivityHistory />
 */
export function HabitActivityHistory(): JSX.Element {
  const [period, setPeriod] = useState<HabitActivityPeriod>('week');
  const { activity, error } = useHabitActivity(period);

  return (
    <Card className="min-w-0 space-y-4 rounded-[1.75rem] p-5">
      <div className="min-w-0 space-y-1">
        <h2 className="font-serif text-xl font-semibold text-ink">{COPY.historyTitle}</h2>
        <p className="text-xs leading-relaxed text-ink-muted">{COPY.historyWeekdayLegend}</p>
      </div>

      <SegmentedControl
        options={PERIOD_OPTIONS}
        value={period}
        onChange={(value) => {
          if (isHabitActivityPeriod(value)) {
            setPeriod(value);
          }
        }}
        ariaLabel={COPY.periodAria}
      />

      <section data-testid="habit-activity-history" className="min-w-0">
        <HabitActivityHistoryBody activity={activity} error={error} />
      </section>
    </Card>
  );
}

