import Link from 'next/link';

import { buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { EmptyState } from '@/components/ui/states';
import { UI_COPY } from '@/lib/copy/ui';
import { CORDOBA_TIMEZONE } from '@/lib/time/cordoba';
import { metric } from '@/types/metric';
import { formatDurationMinutes } from './ProgressSummaryCard';
import type { ProgressSessionSummary } from '@/lib/services/progress-summary';

interface RecentSessionsCardProps {
  sessions: ProgressSessionSummary[];
}

const DATE_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  timeZone: CORDOBA_TIMEZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * Recent completed sessions list for the Progress tab.
 *
 * @param props Completed sessions ordered by recency.
 * @returns Card with links to workout details or an empty state.
 * @example
 * <RecentSessionsCard sessions={summary.sessions} />
 */
export function RecentSessionsCard({ sessions }: RecentSessionsCardProps) {
  return (
    <Card className="space-y-4">
      <h2 className="font-serif text-xl font-semibold text-ink">{UI_COPY.progressRecentSessionsTitle}</h2>
      {sessions.length === 0 ? (
        <EmptyState
          title={UI_COPY.emptyWorkoutsTitle}
          description={UI_COPY.emptyWorkoutsBody}
          action={
            <Link href="/dashboard" className={buttonClassName({ variant: 'primary' })}>
              {UI_COPY.startFirstWorkout}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li key={session.workoutId}>
              <Link
                href={`/dashboard/workout/${session.workoutId}`}
                className="block rounded-lg border border-line p-3 transition hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">
                      {session.routineName ?? UI_COPY.progressFreeWorkout}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {DATE_FORMATTER.format(new Date(session.startedAt))}
                    </p>
                  </div>
                  {session.durationMinutes === null ? null : (
                    <MetricValue
                      metric={metric(formatDurationMinutes(session.durationMinutes), 'atlas_computed')}
                      label={UI_COPY.progressSessionDurationLabel}
                      className="shrink-0 text-sm"
                    />
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
