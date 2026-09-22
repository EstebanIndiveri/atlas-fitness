'use client';

import { AtlasInterpretationCard } from '@/components/progress/AtlasInterpretationCard';
import {
  HabitConsistencyCard,
  StrengthEvolutionCard,
  WellbeingCard,
} from '@/components/progress/ProgressInsightCards';
import { ProgressHeader } from '@/components/progress/ProgressHeader';
import { ProgressSummaryCard } from '@/components/progress/ProgressSummaryCard';
import { RecentSessionsCard } from '@/components/progress/RecentSessionsCard';
import { formatWeekConsistencyPercent } from '@/components/progress/ProgressFormat';
import { WeeklyConsistencyCard } from '@/components/progress/WeeklyConsistencyCard';
import { PageContainer } from '@/components/shell/PageContainer';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useDailyCheckin } from '@/hooks/useDailyCheckin';
import { useHabits } from '@/hooks/useHabits';
import { cn } from '@/lib/ui/cn';
import { useProgress } from '@/hooks/useProgress';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import type { ProgressPeriod } from '@/lib/services/progress-summary';
import type { StrengthProgressSummary } from '@/lib/services/strength-progress';

const PERIOD_OPTIONS: ReadonlyArray<{ value: ProgressPeriod; label: string }> = [
  { value: 'week', label: PROGRESS_COPY.periods.week },
  { value: 'month', label: PROGRESS_COPY.periods.month },
  { value: 'quarter', label: PROGRESS_COPY.periods.quarter },
];

const EMPTY_STRENGTH: StrengthProgressSummary = {
  hasLoggedSets: false,
  latestVolumeKg: null,
  trendLabel: 'Sin datos de fuerza',
  points: [],
};

function isProgressPeriod(value: string): value is ProgressPeriod {
  return value === 'week' || value === 'month' || value === 'quarter';
}

interface PeriodTabsProps {
  period: ProgressPeriod;
  onChange: (period: ProgressPeriod) => void;
}

function PeriodTabs({ period, onChange }: PeriodTabsProps) {
  return (
    <div
      role="radiogroup"
      aria-label={PROGRESS_COPY.periodAria}
      className="grid rounded-full bg-surface p-1 shadow-card ring-1 ring-line"
      style={{ gridTemplateColumns: `repeat(${PERIOD_OPTIONS.length}, minmax(0, 1fr))` }}
    >
      {PERIOD_OPTIONS.map((option) => {
        const selected = option.value === period;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              selected ? 'bg-ink text-surface shadow-sm' : 'text-ink-muted hover:bg-canvas hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Figma-aligned Progreso dashboard tab backed by real Atlas data.
 *
 * @returns Data-honest progress screen with loading, error, empty and populated states.
 * @example
 * <ProgressPage />
 */
export default function ProgressPage() {
  const { summary, week, loading, error, period, setPeriod } = useProgress();
  const checkin = useDailyCheckin();
  const habits = useHabits();

  const handlePeriodChange = (next: string): void => {
    if (isProgressPeriod(next)) {
      setPeriod(next);
    }
  };

  const consistencyPercent = summary?.period === 'week' && week ? formatWeekConsistencyPercent(week.activeCount) : null;

  return (
    <PageContainer className="max-w-md space-y-5 pb-32">
      <ProgressHeader
        fromLocalDate={summary?.fromLocalDate ?? null}
        toLocalDate={summary?.toLocalDate ?? null}
        updated={Boolean(summary && !loading && !error)}
      />

      <PeriodTabs period={period} onChange={handlePeriodChange} />

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState title={PROGRESS_COPY.states.errorTitle} message={error} compact={false} /> : null}
      {!loading && !error && summary ? (
        <>
          <AtlasInterpretationCard summary={summary} week={week} />
          <ProgressSummaryCard
            period={summary.period}
            completedSessions={summary.completedSessions}
            totalDurationMinutes={summary.totalDurationMinutes}
            consistencyPercent={consistencyPercent}
          />
          <WeeklyConsistencyCard week={week} />
          <StrengthEvolutionCard strength={summary.strength ?? EMPTY_STRENGTH} />
          <WellbeingCard
            checkin={checkin.checkin}
            loading={checkin.loading}
            error={checkin.error}
          />
          <HabitConsistencyCard
            doneByKey={habits.doneByKey}
            loading={habits.loading}
            error={habits.error}
          />
          <RecentSessionsCard sessions={summary.sessions} />
        </>
      ) : null}
    </PageContainer>
  );
}
