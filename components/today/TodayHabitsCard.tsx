'use client';

import { HabitPreviewRow, type HabitPreview } from '@/components/today/HabitPreviewRow';
import { HydrationHabitRow } from '@/components/today/HydrationHabitRow';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useHabits } from '@/hooks/useHabits';
import { isQuantitativeHabitKey } from '@/types/habit';

const COPY = {
  heading: 'Hábitos de hoy',
  note: 'Tocá cada hábito para registrar que lo cumpliste hoy. Atlas los usa como contexto real, sin inventar números.',
} as const;

const HABIT_PREVIEWS: readonly HabitPreview[] = [
  { id: 'hydration', name: 'Hidratación', hint: 'Sumá tus litros de hoy', icon: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z' },
  { id: 'walk', name: 'Caminar', hint: 'Movimiento diario', icon: 'M13 4a1.5 1.5 0 1 0 0-.01 M11 8l-2 4 3 2v6 M9 12l-3 3 M13 14l3 1 1 5' },
  { id: 'mobility', name: 'Movilidad', hint: 'Cadera y tren superior', icon: 'M12 4a1.5 1.5 0 1 0 0-.01 M8 9h8 M12 9v5 M9 20l3-6 3 6' },
  { id: 'sleep', name: 'Dormir', hint: 'Descanso nocturno', icon: 'M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5z' },
] as const;

/**
 * Habits section for the Today screen.
 *
 * Renders one checkbox per habit in the honest catalog, wired to `/api/habits`
 * via {@link useHabits}. Each toggle is `source: user_input`; no counts, ratios,
 * or progress percentages are shown (DATA HONESTY RULE).
 * @returns Habits card with interactive, data-honest completion toggles.
 * @example <TodayHabitsCard />
 */
export function TodayHabitsCard() {
  const { doneByKey, amountByKey, loading, saving, error, toggle, addAmount, clearAmount } =
    useHabits();

  return (
    <Card className="space-y-3 p-5">
      <h2 className="font-serif text-xl font-semibold text-ink">{COPY.heading}</h2>

      {loading ? <LoadingState compact /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading ? (
        <ul className="divide-y divide-line" data-testid="habit-preview-list">
          {HABIT_PREVIEWS.map((habit) =>
            isQuantitativeHabitKey(habit.id) ? (
              <HydrationHabitRow
                key={habit.id}
                habit={habit}
                amount={amountByKey[habit.id]}
                onAdd={addAmount}
                onClear={clearAmount}
                disabled={saving}
              />
            ) : (
              <HabitPreviewRow
                key={habit.id}
                habit={habit}
                done={doneByKey[habit.id]}
                onToggle={toggle}
                disabled={saving}
              />
            ),
          )}
        </ul>
      ) : null}

      <p className="text-xs leading-relaxed text-ink-muted">{COPY.note}</p>
    </Card>
  );
}
