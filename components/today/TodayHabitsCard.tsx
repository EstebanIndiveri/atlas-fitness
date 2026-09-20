import { HabitPreviewRow, type HabitPreview } from '@/components/today/HabitPreviewRow';
import { Card } from '@/components/ui/Card';

const COPY = {
  heading: 'Hábitos de hoy',
  note: 'Pronto vas a poder registrar estos hábitos. Atlas los va a usar como contexto real, sin inventar números.',
  soon: 'Próximamente',
};

const HABIT_PREVIEWS: readonly HabitPreview[] = [
  { id: 'hydration', name: 'Hidratación', hint: 'Objetivo diario', icon: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z' },
  { id: 'walk', name: 'Caminar', hint: 'Movimiento diario', icon: 'M13 4a1.5 1.5 0 1 0 0-.01 M11 8l-2 4 3 2v6 M9 12l-3 3 M13 14l3 1 1 5' },
  { id: 'mobility', name: 'Movilidad', hint: 'Cadera y tren superior', icon: 'M12 4a1.5 1.5 0 1 0 0-.01 M8 9h8 M12 9v5 M9 20l3-6 3 6' },
  { id: 'sleep', name: 'Dormir', hint: 'Descanso nocturno', icon: 'M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5z' },
] as const;

/**
 * Habits section for the Today screen.
 *
 * Renders the structural preview of the planned habits (icon, name, static hint)
 * with an honest "coming soon" marker. There is no Habit/HabitEntry backend yet,
 * so no counts, ratios or progress percentages are shown (DATA HONESTY RULE).
 * @returns Habits card with a data-honest preview list.
 * @example <TodayHabitsCard />
 */
export function TodayHabitsCard() {
  return (
    <Card className="space-y-3 p-5">
      <h2 className="font-serif text-xl font-semibold text-ink">{COPY.heading}</h2>
      <ul className="divide-y divide-line" data-testid="habit-preview-list">
        {HABIT_PREVIEWS.map((habit) => (
          <HabitPreviewRow key={habit.id} habit={habit} soonLabel={COPY.soon} />
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-ink-muted">{COPY.note}</p>
    </Card>
  );
}
