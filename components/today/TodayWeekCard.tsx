import { StreakChip } from '@/components/StreakChip';
import { WeekDayStrip } from '@/components/today/WeekDayStrip';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';

const COPY = {
  heading: 'Esta semana',
  daysLabel: 'Tu semana',
  planEmptyTitle: 'Progreso semanal en camino',
  planEmptyDescription:
    'Cuando tengas un plan activo, Atlas va a mostrar acá tu avance real de la semana. Sin métricas inventadas.',
};

/**
 * Weekly section for the Today screen.
 *
 * Reuses {@link StreakChip} for the real streak and {@link WeekDayStrip} for the
 * day structure (today highlighted, no fabricated completion), plus an honest empty
 * state for weekly plan progress, which has no aggregation backend yet (DATA HONESTY RULE).
 * @returns Weekly card with real streak, day strip and a plan-progress empty state.
 * @example <TodayWeekCard />
 */
export function TodayWeekCard() {
  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-serif text-xl font-semibold text-ink">{COPY.heading}</h2>
      <StreakChip />
      <section className="space-y-2" aria-label={COPY.daysLabel}>
        <WeekDayStrip />
      </section>
      <EmptyState title={COPY.planEmptyTitle} description={COPY.planEmptyDescription} />
    </Card>
  );
}
