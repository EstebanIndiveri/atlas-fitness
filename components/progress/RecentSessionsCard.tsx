import Link from 'next/link';

import { buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { EmptyState } from '@/components/ui/states';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import { metric } from '@/types/metric';
import { formatDurationMinutes, formatSessionDate } from './ProgressFormat';
import type { ProgressSessionSummary } from '@/lib/services/progress-summary';

interface RecentSessionsCardProps {
  sessions: ProgressSessionSummary[];
}

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
    <Card className="space-y-4 rounded-[28px] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{PROGRESS_COPY.sessions.title}</h2>
      </div>
      {sessions.length === 0 ? (
        <EmptyState
          title={PROGRESS_COPY.sessions.emptyTitle}
          description={PROGRESS_COPY.sessions.emptyBody}
          action={
            <Link href="/dashboard/today" className={buttonClassName({ variant: 'primary' })}>
              {PROGRESS_COPY.sessions.startFirstWorkout}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li key={session.workoutId}>
              <Link
                href={`/dashboard/workout/${session.workoutId}`}
                className="block rounded-2xl border border-line bg-canvas/60 p-3 transition hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">
                      {session.routineName ?? PROGRESS_COPY.sessions.freeWorkout}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {formatSessionDate(session.startedAt)}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {PROGRESS_COPY.sessions.volumeUnavailable}
                    </p>
                  </div>
                  {session.durationMinutes === null ? (
                    <span className="shrink-0 text-right text-xs font-medium text-ink-muted">
                      {PROGRESS_COPY.sessions.durationUnavailable}
                    </span>
                  ) : (
                    <MetricValue
                      metric={metric(formatDurationMinutes(session.durationMinutes), 'atlas_computed')}
                      label={PROGRESS_COPY.sessions.durationLabel}
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
