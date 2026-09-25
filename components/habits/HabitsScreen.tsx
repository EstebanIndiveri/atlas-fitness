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
  completed: (done: number, total: number) => `${done} de ${total} completados`,
  retry: 'Reintentar',
} as const;

/**
 * Dedicated view of today's manually recorded habits.
 *
 * Uses the same hook, catalog, rows, and completion calculation as Today.
 * When data is unavailable, it hides default values so they are not presented
 * as real empty-day data.
 * @returns Today's habit controls or their loading/unavailable state.
 */
export function HabitsScreen(): JSX.Element {
  const { doneByKey, amountByKey, loading, saving, error, reload, toggle, addAmount, clearAmount } =
    useHabits();

  if (loading) {
    return (
      <Card className="rounded-[1.75rem] p-5">
        <LoadingState />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="space-y-4 rounded-[1.75rem] p-5">
        <ErrorState message={error} compact={false} />
        <button
          type="button"
          onClick={reload}
          className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {COPY.retry}
        </button>
      </Card>
    );
  }

  const completedCount = countCompletedHabits(doneByKey);

  return (
    <Card className="space-y-3 rounded-[1.75rem] p-5">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <h2 className="min-w-0 font-serif text-xl font-semibold text-ink">Hábitos Diarios</h2>
        <p className="shrink-0 text-right text-sm font-semibold text-ink-muted">
          {COPY.completed(completedCount, HABIT_PREVIEWS.length)}
        </p>
      </div>

      <ul className="min-w-0 divide-y divide-line" data-testid="habits-list">
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

      <p className="text-xs leading-relaxed text-ink-muted">
        Atlas muestra solo valores registrados manualmente. No hay metas ni métricas automáticas.
      </p>
    </Card>
  );
}
