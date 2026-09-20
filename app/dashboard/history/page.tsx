'use client';

import { useMemo } from 'react';

import { ProgressSummaryCard } from '@/components/progress/ProgressSummaryCard';
import { RecentSessionsCard } from '@/components/progress/RecentSessionsCard';
import { WeeklyConsistencyCard } from '@/components/progress/WeeklyConsistencyCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useProgress } from '@/hooks/useProgress';
import { UI_COPY, UI_COPY_TEST_IDS } from '@/lib/copy/ui';
import { CORDOBA_TIMEZONE } from '@/lib/time/cordoba';
import type { ProgressPeriod } from '@/lib/services/progress-summary';

const PERIOD_OPTIONS: ReadonlyArray<{ value: ProgressPeriod; label: string }> = [
  { value: 'week', label: UI_COPY.progressPeriodWeek },
  { value: 'month', label: UI_COPY.progressPeriodMonth },
  { value: 'quarter', label: UI_COPY.progressPeriodQuarter },
];

const SUBTITLE_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  timeZone: CORDOBA_TIMEZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Progress dashboard tab.
 *
 * @returns Data-honest progress screen backed by real summary and week endpoints.
 * @example
 * <ProgressPage />
 */
export default function ProgressPage() {
  const { summary, week, loading, error, period, setPeriod } = useProgress();
  const subtitle = useMemo(
    () => `${UI_COPY.progressSubtitlePrefix} ${SUBTITLE_FORMATTER.format(new Date())}`,
    [],
  );
  const handlePeriodChange = (next: string): void => {
    if (next === 'week' || next === 'month' || next === 'quarter') {
      setPeriod(next);
    }
  };

  return (
    <main
      className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-4 sm:py-6"
      data-testid={UI_COPY_TEST_IDS.progressScreen}
    >
      <header className="space-y-2">
        <p className="text-sm font-medium text-ink-muted">{subtitle}</p>
        <h1 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-ink">
          {UI_COPY.progressTitle}
        </h1>
      </header>

      <SegmentedControl
        ariaLabel={UI_COPY.progressPeriodAria}
        options={PERIOD_OPTIONS}
        value={period}
        onChange={handlePeriodChange}
      />

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState message={error} compact={false} /> : null}
      {!loading && !error && summary ? (
        <>
          <ProgressSummaryCard
            completedSessions={summary.completedSessions}
            totalDurationMinutes={summary.totalDurationMinutes}
          />
          <WeeklyConsistencyCard week={week} />
          <RecentSessionsCard sessions={summary.sessions} />
        </>
      ) : null}
    </main>
  );
}
