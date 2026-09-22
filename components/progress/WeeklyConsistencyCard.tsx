import { WeekDayStrip } from '@/components/today/WeekDayStrip';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { EmptyState } from '@/components/ui/states';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import { metric } from '@/types/metric';
import type { WeekConsistency } from '@/types/week';
import { formatWeekConsistencyPercent } from './ProgressFormat';

interface WeeklyConsistencyCardProps {
  week: WeekConsistency | null;
}

/**
 * Current-week consistency card for the Progress tab.
 *
 * @param props Current Córdoba week consistency or null when unavailable.
 * @returns A card with real active-day count, percentage and accessible day markers.
 * @example
 * <WeeklyConsistencyCard week={week} />
 */
export function WeeklyConsistencyCard({ week }: WeeklyConsistencyCardProps) {
  if (!week) {
    return (
      <Card className="rounded-2xl p-5">
        <EmptyState
          title={PROGRESS_COPY.week.emptyTitle}
          description={PROGRESS_COPY.week.emptyBody}
        />
      </Card>
    );
  }

  const consistencyPercent = formatWeekConsistencyPercent(week.activeCount);

  return (
    <Card className="space-y-4 overflow-hidden rounded-[28px] p-5">
      <div data-testid="weekly-consistency-header" className="flex min-w-0 flex-col gap-3">
        <div className="min-w-0 break-words">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">{PROGRESS_COPY.week.title}</h2>
            <span className="shrink-0 rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-ink-muted">
              Media {consistencyPercent}%
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">{PROGRESS_COPY.week.body}</p>
        </div>
        <div
          data-testid="weekly-consistency-metrics"
          className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl bg-canvas p-3"
        >
          <div aria-label={PROGRESS_COPY.week.percentLabel} className="min-w-0">
            <MetricValue
              metric={metric(`${consistencyPercent}%`, 'atlas_computed')}
              label={PROGRESS_COPY.week.percentLabel}
              showSource
              className="flex min-w-0 flex-wrap text-2xl leading-tight tabular-nums [overflow-wrap:anywhere]"
            />
          </div>
          <div aria-label={PROGRESS_COPY.week.activeLabel} className="min-w-0 text-sm text-ink-muted">
            <span>Días activos: </span>
            <MetricValue
              metric={metric(`${week.activeCount} de 7`, 'atlas_computed')}
              label={PROGRESS_COPY.week.activeLabel}
              className="inline-flex min-w-0 flex-wrap leading-tight tabular-nums [overflow-wrap:anywhere]"
            />
          </div>
        </div>
      </div>
      <div className="space-y-2 rounded-2xl bg-canvas/70 p-3">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-ink-muted">
          <span>Semana actual</span>
          <span>{consistencyPercent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Barra de consistencia semanal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={consistencyPercent}
          className="h-2.5 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full bg-brand" style={{ width: `${consistencyPercent}%` }} />
        </div>
      </div>
      <WeekDayStrip days={week.days} />
    </Card>
  );
}
