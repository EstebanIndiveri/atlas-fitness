import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';

const COPY = {
  heading: 'Hábitos de hoy',
  emptyTitle: 'Todavía no hay hábitos',
  emptyDescription:
    'Pronto vas a poder registrar agua, sueño y movilidad. Atlas los usará como contexto real, sin inventar números.',
};

/**
 * Habits section for the Today screen.
 *
 * Renders an honest empty state: there is no Habit/HabitEntry backend yet, so no
 * fabricated counts or progress are shown (DATA HONESTY RULE).
 * @returns Habits card with a "coming soon" empty state.
 * @example <TodayHabitsCard />
 */
export function TodayHabitsCard() {
  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-serif text-xl font-semibold text-ink">{COPY.heading}</h2>
      <EmptyState title={COPY.emptyTitle} description={COPY.emptyDescription} />
    </Card>
  );
}
