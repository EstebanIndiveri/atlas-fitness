'use client';

import type { JSX } from 'react';

import { HABIT_PREVIEWS, countCompletedHabits } from '@/components/habits/habit-catalog';
import { HabitPreviewRow } from '@/components/today/HabitPreviewRow';
import { HydrationHabitRow } from '@/components/today/HydrationHabitRow';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useHabits } from '@/hooks/useHabits';
import { isQuantitativeHabitKey } from '@/types/habit';

const COPY = {
  heading: 'Hábitos Diarios',
  completed: (done: number, total: number) => `${done} de ${total} completados`,
  note: 'Atlas muestra solo valores registrados. Pasos, sueño y objetivos quedan como estado honesto si no existe una fuente real.',
} as const;

/**
 * Habits section for the Today screen.
 *
 * Renders one checkbox per habit in the honest catalog, wired to `/api/habits`
 * via {@link useHabits}. Each toggle is `source: user_input`; no counts, ratios,
 * or progress percentages are shown (DATA HONESTY RULE).
 * @returns Habits card with interactive, data-honest completion toggles.
 * @example <TodayHabitsCard />
 */
export function TodayHabitsCard(): JSX.Element {
  const { doneByKey, amountByKey, loading, saving, error, toggle, addAmount, clearAmount } =
    useHabits();
  const completedCount = countCompletedHabits(doneByKey);

  return (
    <Card className="space-y-3 rounded-[1.75rem] p-5">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <h2 className="min-w-0 font-serif text-xl font-semibold text-ink">{COPY.heading}</h2>
        <p className="shrink-0 text-right text-sm font-semibold text-ink-muted">
          {COPY.completed(completedCount, HABIT_PREVIEWS.length)}
        </p>
      </div>

      {loading ? <LoadingState compact /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading ? (
        <ul className="min-w-0 divide-y divide-line" data-testid="habit-preview-list">
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
