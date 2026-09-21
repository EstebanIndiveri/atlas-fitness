import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
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
}

function SummaryStat({ label, metricLabel, value, hint }: SummaryStatProps) {
  return (
    <div aria-label={metricLabel} className="rounded-xl bg-canvas p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <MetricValue
        metric={metric(value, 'atlas_computed')}
        label={metricLabel}
        className="mt-2 text-lg"
      />
      {hint ? <p className="mt-1 text-[11px] leading-snug text-ink-muted">{hint}</p> : null}
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
    <Card className="space-y-4 rounded-2xl p-5">
      <h2 className="text-base font-semibold text-ink">{PROGRESS_COPY.summary.titles[period]}</h2>
      <div className="grid grid-cols-3 gap-2">
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
        />
      </div>
    </Card>
  );
}
