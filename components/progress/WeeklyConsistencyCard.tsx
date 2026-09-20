import { WeekDayStrip } from '@/components/today/WeekDayStrip';
import { Card } from '@/components/ui/Card';
import { MetricValue } from '@/components/ui/MetricValue';
import { EmptyState } from '@/components/ui/states';
import { UI_COPY } from '@/lib/copy/ui';
import { metric } from '@/types/metric';
import type { WeekConsistency } from '@/types/week';

interface WeeklyConsistencyCardProps {
  week: WeekConsistency | null;
}

/**
 * Current-week consistency card for the Progress tab.
 *
 * @param props Current Córdoba week consistency or null when unavailable.
 * @returns A card with real active-day count and accessible day markers.
 * @example
 * <WeeklyConsistencyCard week={week} />
 */
export function WeeklyConsistencyCard({ week }: WeeklyConsistencyCardProps) {
  if (!week) {
    return (
      <Card>
        <EmptyState
          title={UI_COPY.progressWeekEmptyTitle}
          description={UI_COPY.progressWeekEmptyBody}
        />
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-semibold text-ink">
            {UI_COPY.progressWeekTitle}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{UI_COPY.progressWeekBody}</p>
        </div>
        <div aria-label={UI_COPY.progressWeekActiveLabel} className="text-right">
          <MetricValue
            metric={metric(`${week.activeCount} de 7`, 'atlas_computed')}
            label={UI_COPY.progressWeekActiveLabel}
            className="text-lg"
          />
        </div>
      </div>
      <WeekDayStrip days={week.days} />
    </Card>
  );
}
