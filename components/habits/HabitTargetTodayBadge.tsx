import type { JSX } from 'react';

import { HABIT_TARGET_COPY } from '@/lib/copy/habit-targets';
import type { HabitKey } from '@/types/habit';

interface HabitTargetTodayBadgeProps {
  habitKey: HabitKey;
}

/**
 * Small, non-interactive marker that names a habit as an objective for today.
 *
 * It never hides or disables the row: a habit that is not an objective can still
 * be recorded. The label is exposed as text, not only as colour.
 *
 * @param props Habit key, used to build a stable test handle.
 * @returns The `Objetivo de hoy` badge.
 * @example
 * {expectedToday ? <HabitTargetTodayBadge habitKey="walk" /> : null}
 */
export function HabitTargetTodayBadge({ habitKey }: HabitTargetTodayBadgeProps): JSX.Element {
  return (
    <span
      data-testid={`habit-target-today-${habitKey}`}
      className="inline-flex items-center rounded-full bg-brand-muted px-2 py-0.5 text-[0.65rem] font-semibold text-brand"
    >
      {HABIT_TARGET_COPY.objectiveToday}
    </span>
  );
}
