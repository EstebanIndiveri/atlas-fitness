'use client';

import type { JSX } from 'react';
import { useState } from 'react';

import { HABIT_PREVIEWS } from '@/components/habits/habit-catalog';
import { HabitTargetDayLegend, HabitTargetDayStrip } from '@/components/habits/habit-target-marks';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useHabitAdherence } from '@/hooks/useHabitAdherence';
import { HABIT_TARGET_COPY } from '@/lib/copy/habit-targets';
import { metric } from '@/types/metric';
import type {
  HabitTargetAdherencePeriod,
  HabitTargetAdherenceWindow,
  HabitTargetDay,
  HabitTargetHabitAdherence,
} from '@/types/habit-adherence';

const PERIOD_OPTIONS = [
  { value: 'week', label: HABIT_TARGET_COPY.periods.week },
  { value: 'month', label: HABIT_TARGET_COPY.periods.month },
  { value: 'quarter', label: HABIT_TARGET_COPY.periods.quarter },
] as const;

function isHabitTargetPeriod(value: string): value is HabitTargetAdherencePeriod {
  return PERIOD_OPTIONS.some((option) => option.value === value);
}

interface HabitResultRowProps {
  habit: (typeof HABIT_PREVIEWS)[number];
  result: HabitTargetHabitAdherence;
  days: readonly HabitTargetDay[];
}

/**
 * One habit of the read-back: its honest `N de M días objetivo`, an optional
 * derived percent, any extra records, and its ordered daily states.
 *
 * `no_expected_days` never renders a ratio; extra records are named as activity
 * outside the objective, never as a miss.
 */
function HabitResultRow({ habit, result, days }: HabitResultRowProps): JSX.Element {
  return (
    <li data-testid={`habit-target-history-habit-${habit.id}`} className="min-w-0 space-y-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{habit.name}</span>
        {result.metricState === 'result' ? (
          <span className="flex items-baseline gap-2">
            <MetricValue
              metric={metric(
                HABIT_TARGET_COPY.habitCountsLabel(
                  habit.name,
                  result.completedExpectedHabitDays,
                  result.expectedHabitDays,
                ),
                'atlas_computed',
              )}
              showSource
              className="text-sm"
            />
            {result.adherencePercent !== null ? (
              <span className="text-xs font-semibold text-ink-muted">
                {HABIT_TARGET_COPY.percentLabel(result.adherencePercent)}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-xs text-ink-muted">{HABIT_TARGET_COPY.historyEmptyHabit}</span>
        )}
      </div>

      {result.extraRecordedHabitDays > 0 ? (
        <p className="text-xs text-ink-muted">
          {HABIT_TARGET_COPY.extraRecordedLabel(result.extraRecordedHabitDays)}
        </p>
      ) : null}

      <HabitTargetDayStrip habitName={habit.name} habitKey={habit.id} days={days} />
    </li>
  );
}

interface HabitTargetHistoryBodyProps {
  adherence: HabitTargetAdherenceWindow | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function HabitTargetHistoryBody({
  adherence,
  loading,
  error,
  onRetry,
}: HabitTargetHistoryBodyProps): JSX.Element | null {
  if (loading) {
    return (
      <p
        data-testid="habit-target-history-loading"
        aria-live="polite"
        className="text-sm leading-relaxed text-ink-muted"
      >
        {HABIT_TARGET_COPY.historyLoading}
      </p>
    );
  }

  if (error !== null) {
    return (
      <div
        data-testid="habit-target-history-error"
        className="space-y-2 rounded-xl bg-danger-muted p-3 text-sm text-danger"
      >
        <p aria-live="polite">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-lg border border-danger px-4 text-sm font-semibold text-danger transition hover:bg-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
        >
          {HABIT_TARGET_COPY.historyRetry}
        </button>
      </div>
    );
  }

  if (adherence === null) {
    return null;
  }

  return (
    <div className="min-w-0 space-y-4">
      {adherence.metricState === 'no_expected_days' ? (
        <p data-testid="habit-target-history-empty" className="text-sm leading-relaxed text-ink-muted">
          {HABIT_TARGET_COPY.historyEmpty}
        </p>
      ) : (
        <div data-testid="habit-target-history-summary" className="min-w-0 space-y-1">
          <MetricValue
            metric={metric(
              HABIT_TARGET_COPY.globalCountsLabel(
                adherence.completedExpectedHabitDays,
                adherence.expectedHabitDays,
              ),
              'atlas_computed',
            )}
            showSource
            className="text-sm"
          />
          {adherence.adherencePercent !== null ? (
            <p className="text-xs font-semibold text-ink-muted">
              {HABIT_TARGET_COPY.percentLabel(adherence.adherencePercent)}
            </p>
          ) : null}
          {adherence.configurationState === 'not_configured' ? (
            <p className="text-xs leading-relaxed text-ink-muted">
              {HABIT_TARGET_COPY.historicalResultNote}
            </p>
          ) : null}
        </div>
      )}

      <ul className="min-w-0 space-y-4">
        {HABIT_PREVIEWS.map((habit) => (
          <HabitResultRow
            key={habit.id}
            habit={habit}
            result={adherence.perHabit[habit.id]}
            days={adherence.days}
          />
        ))}
      </ul>

      <HabitTargetDayLegend />
    </div>
  );
}

interface HabitTargetAdherenceHistoryProps {
  /** Bumped by a target mutation so the window refetches without rewriting history. */
  refreshKey?: number;
}

/**
 * Read-back of target adherence for the chosen Córdoba period.
 *
 * The configuration axis (`configurationState`, from the live target) and the
 * window axis (`metricState`, from the elapsed denominator) are independent: an
 * ended target can show `not_configured` while its historical `N de M` stays
 * visible. Counts are always shown for a result and the percent is secondary;
 * `no_expected_days` emits no ratio. Daily marks name the five states honestly.
 *
 * @param props Optional mutation revision used to refetch the window.
 * @returns The period selector plus loading, error, empty or result read-back.
 * @example
 * <HabitTargetAdherenceHistory refreshKey={revision} />
 */
export function HabitTargetAdherenceHistory({
  refreshKey = 0,
}: HabitTargetAdherenceHistoryProps): JSX.Element {
  const [period, setPeriod] = useState<HabitTargetAdherencePeriod>('week');
  const { adherence, loading, error, reload } = useHabitAdherence(period, refreshKey);

  return (
    <Card level="panel" className="min-w-0 space-y-4 p-5">
      <div className="min-w-0 space-y-1">
        <h2 className="font-serif text-xl font-semibold text-ink">
          {HABIT_TARGET_COPY.historyTitle}
        </h2>
        <p className="text-xs leading-relaxed text-ink-muted">{HABIT_TARGET_COPY.historyIntro}</p>
      </div>

      <SegmentedControl
        options={PERIOD_OPTIONS}
        value={period}
        onChange={(value) => {
          if (isHabitTargetPeriod(value)) {
            setPeriod(value);
          }
        }}
        ariaLabel={HABIT_TARGET_COPY.periodAria}
      />

      <section data-testid="habit-target-adherence-history" className="min-w-0">
        <HabitTargetHistoryBody
          adherence={adherence}
          loading={loading}
          error={error}
          onRetry={reload}
        />
      </section>
    </Card>
  );
}
