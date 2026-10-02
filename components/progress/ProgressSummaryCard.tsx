import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { cn } from '@/lib/ui/cn';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import type { ProgressPeriod } from '@/lib/services/progress-summary';
import { metric } from '@/types/metric';
import { formatDurationMinutes } from './ProgressFormat';

interface ProgressSummaryCardProps {
  completedSessions: number;
  totalDurationMinutes: number;
  period?: ProgressPeriod;
  consistencyPercent?: number | null;
}

interface SummaryStatProps {
  label: string;
  metricLabel: string;
  value: string;
  hint?: string;
  className?: string;
}

function SummaryStat({ label, metricLabel, value, hint, className }: SummaryStatProps) {
  return (
    <div
      aria-label={metricLabel}
      data-testid="progress-summary-stat"
      className={cn('flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-canvas p-3.5', className)}
    >
      <p className="break-words text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <MetricValue
        metric={metric(value, 'atlas_computed')}
        label={metricLabel}
        className="mt-2 flex w-full flex-wrap text-xl leading-tight [overflow-wrap:anywhere]"
      />
      {hint ? <p className="mt-1 break-words text-[11px] leading-snug text-ink-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * Summary card for real completed sessions, duration and consistency.
 *
 * @param props Atlas-computed session count, duration, period and optional weekly consistency.
 * @returns Progress summary card with sourced metric values.
 * @example
 * <ProgressSummaryCard period="month" completedSessions={2} totalDurationMinutes={95} consistencyPercent={29} />
 */
export function ProgressSummaryCard({
  completedSessions,
  totalDurationMinutes,
  period = 'month',
  consistencyPercent = null,
}: ProgressSummaryCardProps) {
  return (
    <Card level="panel" className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{PROGRESS_COPY.summary.titles[period]}</h2>
        <span className="shrink-0 rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-ink-muted">
          {completedSessions} {completedSessions === 1 ? 'sesión' : 'sesiones'}
        </span>
      </div>
      <div className="grid grid-cols-2 items-stretch gap-2 min-[520px]:grid-cols-3">
        <SummaryStat
          label={PROGRESS_COPY.summary.sessions}
          metricLabel={PROGRESS_COPY.summary.completedSessionsLabel}
          value={String(completedSessions)}
        />
        <SummaryStat
          label={PROGRESS_COPY.summary.totalTime}
          metricLabel={PROGRESS_COPY.summary.totalTimeLabel}
          value={formatDurationMinutes(totalDurationMinutes)}
        />
        <SummaryStat
          label={PROGRESS_COPY.summary.consistency}
          metricLabel={PROGRESS_COPY.summary.consistency}
          value={
            consistencyPercent === null
              ? PROGRESS_COPY.summary.consistencyUnavailable
              : `${consistencyPercent}%`
          }
          hint={
            consistencyPercent === null ? PROGRESS_COPY.summary.consistencyUnavailableBody : undefined
          }
          className="col-span-2 min-[520px]:col-span-1"
        />
      </div>
      {consistencyPercent === null ? null : (
        <p className="rounded-2xl bg-brand-muted px-3.5 py-3 text-sm leading-relaxed text-brand">
          Cumplís el {consistencyPercent}% de tu consistencia semanal esta semana.
        </p>
      )}
    </Card>
  );
}
