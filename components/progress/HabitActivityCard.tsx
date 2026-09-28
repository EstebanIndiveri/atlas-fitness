import type { JSX } from 'react';

import { formatHabitActivityDate } from '@/components/habits/habit-activity-format';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import { metric } from '@/types/metric';
import type { HabitActivityWindow } from '@/types/habit-activity';

const METRICS_BOX_CLASS =
  'flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl bg-canvas p-3';
const METRIC_VALUE_CLASS =
  'flex min-w-0 flex-wrap text-2xl leading-tight tabular-nums [overflow-wrap:anywhere]';

/**
 * Props for `HabitActivityCard`.
 */
export interface HabitActivityCardProps {
  /** Recorded habit activity for the selected period, or null while it is unavailable. */
  activity: HabitActivityWindow | null;
  /** Whether the activity for the selected period is still being fetched. */
  loading: boolean;
  /** Explicit failure copy, or null when no failure happened. */
  error: string | null;
}

interface CountFactProps {
  label: string;
  value: number;
}

function CountFact({ label, value }: CountFactProps): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <MetricValue
        metric={metric(value, 'atlas_computed')}
        label={label}
        showSource
        className={METRIC_VALUE_CLASS}
      />
    </div>
  );
}

function HabitActivityBody({
  activity,
  loading,
  error,
}: HabitActivityCardProps): JSX.Element {
  if (loading) {
    return <LoadingState label={PROGRESS_COPY.habitActivity.loading} />;
  }

  if (error !== null || activity === null) {
    return (
      <ErrorState
        message={error ?? PROGRESS_COPY.habitActivity.unavailable}
        compact={false}
      />
    );
  }

  const { activeDays, elapsedDays, insightMinimumElapsedDays, insightStatus } =
    activity;

  if (insightStatus !== 'available') {
    return (
      <div data-testid="habit-activity-metrics" className={METRICS_BOX_CLASS}>
        <EmptyState
          title={PROGRESS_COPY.habitActivity.insufficientTitle}
          description={
            elapsedDays < insightMinimumElapsedDays
              ? PROGRESS_COPY.habitActivity.insufficientElapsed(
                  elapsedDays,
                  insightMinimumElapsedDays,
                )
              : PROGRESS_COPY.habitActivity.insufficientNoActivity
          }
        />
        <CountFact
          label={PROGRESS_COPY.habitActivity.elapsedDaysLabel}
          value={elapsedDays}
        />
      </div>
    );
  }

  return (
    <div data-testid="habit-activity-metrics" className={METRICS_BOX_CLASS}>
      <p className="text-sm text-ink-muted">
        {PROGRESS_COPY.habitActivity.summary(activeDays, elapsedDays)}
      </p>
      <CountFact
        label={PROGRESS_COPY.habitActivity.activeDaysLabel}
        value={activeDays}
      />
      <CountFact
        label={PROGRESS_COPY.habitActivity.elapsedDaysLabel}
        value={elapsedDays}
      />
    </div>
  );
}

/**
 * Habit-activity card for the Progress tab.
 *
 * Reports the days with recorded habit activity for the selected period, plus the
 * elapsed days of that window as a declared calendar fact. It never divides by a
 * stored target, never renders a percentage, and never presents an empty default as
 * a measurement: an insufficient window only names why it cannot be summarised.
 *
 * @param props Recorded activity window plus its loading and error state.
 * @returns A card with the recorded-day count, the denominator and its declared source.
 * @example
 * <HabitActivityCard activity={activity} loading={loading} error={error} />
 */
export function HabitActivityCard({
  activity,
  loading,
  error,
}: HabitActivityCardProps): JSX.Element {
  const windowCaption =
    !loading && error === null && activity !== null
      ? PROGRESS_COPY.habitActivity.windowLabel(
          formatHabitActivityDate(activity.windowStart),
          formatHabitActivityDate(activity.windowEnd),
        )
      : null;

  return (
    <Card className="space-y-4 overflow-hidden rounded-[28px] p-5">
      <div className="min-w-0">
        <h2 className="break-words text-base font-semibold text-ink">
          {PROGRESS_COPY.habitActivity.title}
        </h2>
        {windowCaption !== null && (
          <p className="mt-1 text-sm text-ink-muted">{windowCaption}</p>
        )}
      </div>
      <HabitActivityBody activity={activity} loading={loading} error={error} />
    </Card>
  );
}
