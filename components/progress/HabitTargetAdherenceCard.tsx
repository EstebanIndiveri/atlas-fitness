import type { JSX } from 'react';

import { formatHabitActivityDate } from '@/components/habits/habit-activity-format';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import { metric } from '@/types/metric';
import type { HabitTargetAdherenceWindow } from '@/types/habit-adherence';
import type { HabitTargetConfigurationState } from '@/types/habit-target';

const METRICS_BOX_CLASS =
  'flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl bg-canvas p-3';
const METRIC_VALUE_CLASS =
  'flex min-w-0 flex-wrap text-2xl leading-tight tabular-nums [overflow-wrap:anywhere]';

/**
 * Props for `HabitTargetAdherenceCard`.
 */
export interface HabitTargetAdherenceCardProps {
  /** Target-adherence window for the selected period, or null while it is unavailable. */
  adherence: HabitTargetAdherenceWindow | null;
  /** Whether the adherence window for the selected period is still being fetched. */
  loading: boolean;
  /** Explicit failure copy, or null when no failure happened. */
  error: string | null;
}

function resolveConfigurationLabel(state: HabitTargetConfigurationState): string {
  if (state === 'not_configured') {
    return PROGRESS_COPY.habitTarget.historicalInactive;
  }
  if (state === 'partially_configured') {
    return PROGRESS_COPY.habitTarget.partialLabel;
  }
  return PROGRESS_COPY.habitTarget.configuredLabel;
}

function HabitTargetAdherenceBody({
  adherence,
  loading,
  error,
}: HabitTargetAdherenceCardProps): JSX.Element {
  if (loading) {
    return <LoadingState label={PROGRESS_COPY.habitTarget.loading} />;
  }

  if (error !== null || adherence === null) {
    return (
      <ErrorState message={error ?? PROGRESS_COPY.habitTarget.unavailable} compact={false} />
    );
  }

  if (adherence.metricState === 'no_expected_days') {
    const notConfigured = adherence.configurationState === 'not_configured';
    return (
      <div data-testid="habit-target-adherence-empty" className={METRICS_BOX_CLASS}>
        <EmptyState
          title={
            notConfigured
              ? PROGRESS_COPY.habitTarget.notConfiguredTitle
              : PROGRESS_COPY.habitTarget.noExpectedTitle
          }
          description={
            notConfigured
              ? PROGRESS_COPY.habitTarget.notConfiguredBody
              : PROGRESS_COPY.habitTarget.noExpectedBody
          }
        />
        {notConfigured ? null : (
          <p className="text-xs text-ink-muted">
            {resolveConfigurationLabel(adherence.configurationState)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div data-testid="habit-target-adherence-result" className={METRICS_BOX_CLASS}>
      <MetricValue
        metric={metric(
          PROGRESS_COPY.habitTarget.resultLabel(
            adherence.completedExpectedHabitDays,
            adherence.expectedHabitDays,
          ),
          'atlas_computed',
        )}
        label={PROGRESS_COPY.habitTarget.resultValueLabel}
        showSource
        className={METRIC_VALUE_CLASS}
      />
      {adherence.adherencePercent !== null ? (
        <MetricValue
          metric={metric(
            PROGRESS_COPY.habitTarget.percentLabel(adherence.adherencePercent),
            'atlas_computed',
          )}
          label={PROGRESS_COPY.habitTarget.percentValueLabel}
          className="text-sm"
        />
      ) : null}
      <p className="text-xs text-ink-muted">{PROGRESS_COPY.habitTarget.provenance}</p>
      <p className="text-xs text-ink-muted">
        {resolveConfigurationLabel(adherence.configurationState)}
      </p>
      {adherence.extraRecordedHabitDays > 0 ? (
        <p className="text-xs text-ink-muted">
          {PROGRESS_COPY.habitTarget.extraLabel(adherence.extraRecordedHabitDays)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Target-adherence card for the Progress tab.
 *
 * Separate from `HabitActivityCard` on purpose: it reports completed expected
 * habit-days over expected elapsed habit-days (explicit user intention), while
 * activity reports observed recorded days. It keeps `configurationState` (current
 * intent) and `metricState` (window denominator) independent, so an ended target
 * can still reveal a historical `N de M` even when no target is active today. It
 * always renders the `N de M días objetivo` counts with provenance; the percentage
 * only ever accompanies them. A zero denominator renders an explicit empty state
 * and never a ratio, a percentage or `NaN`.
 *
 * @param props Adherence window plus its loading and error state.
 * @returns A card with honest target-adherence counts or an explicit empty/error state.
 * @example
 * <HabitTargetAdherenceCard adherence={adherence} loading={loading} error={error} />
 */
export function HabitTargetAdherenceCard({
  adherence,
  loading,
  error,
}: HabitTargetAdherenceCardProps): JSX.Element {
  const windowCaption =
    !loading && error === null && adherence !== null
      ? PROGRESS_COPY.habitTarget.windowLabel(
          formatHabitActivityDate(adherence.windowStart),
          formatHabitActivityDate(adherence.windowEnd),
        )
      : null;

  return (
    <Card className="space-y-4 overflow-hidden rounded-[28px] p-5">
      <div className="min-w-0">
        <h2 className="break-words text-base font-semibold text-ink">
          {PROGRESS_COPY.habitTarget.title}
        </h2>
        {windowCaption !== null && (
          <p className="mt-1 text-sm text-ink-muted">{windowCaption}</p>
        )}
      </div>
      <HabitTargetAdherenceBody adherence={adherence} loading={loading} error={error} />
    </Card>
  );
}
