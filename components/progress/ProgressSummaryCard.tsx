import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { UI_COPY } from '@/lib/copy/ui';
import { metric } from '@/types/metric';

interface ProgressSummaryCardProps {
  completedSessions: number;
  totalDurationMinutes: number;
}

/**
 * Formats minutes as a compact hours/minutes label.
 *
 * @param minutes Total duration in minutes.
 * @returns Human-readable duration.
 * @example
 * formatDurationMinutes(95) // "1h 35m"
 */
export function formatDurationMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) {
    return `${remaining}m`;
  }
  if (remaining === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remaining}m`;
}

/**
 * Summary card for real completed sessions and total duration.
 *
 * @param props Atlas-computed session count and duration.
 * @returns Progress summary card with sourced metric values.
 * @example
 * <ProgressSummaryCard completedSessions={2} totalDurationMinutes={95} />
 */
export function ProgressSummaryCard({
  completedSessions,
  totalDurationMinutes,
}: ProgressSummaryCardProps) {
  const sessionLabel = completedSessions === 1 ? UI_COPY.progressSessionSingular : UI_COPY.progressSessionPlural;

  return (
    <Card className="space-y-4">
      <h2 className="font-serif text-xl font-semibold text-ink">{UI_COPY.progressSummaryTitle}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div aria-label={UI_COPY.progressCompletedSessionsLabel} className="rounded-lg bg-canvas p-3">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
            {UI_COPY.progressSessions}
          </p>
          <MetricValue
            metric={metric(`${completedSessions} ${sessionLabel}`, 'atlas_computed')}
            label={UI_COPY.progressCompletedSessionsLabel}
            className="mt-2 text-lg"
          />
        </div>
        <div aria-label={UI_COPY.progressTotalTimeLabel} className="rounded-lg bg-canvas p-3">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
            {UI_COPY.progressTotalTime}
          </p>
          <MetricValue
            metric={metric(formatDurationMinutes(totalDurationMinutes), 'atlas_computed')}
            label={UI_COPY.progressTotalTimeLabel}
            className="mt-2 text-lg"
          />
        </div>
      </div>
    </Card>
  );
}
