'use client';

import type { JSX } from 'react';

import { WEEKDAY_DISPLAY_ORDER, toggleWeekday } from '@/components/habits/habit-target-format';
import { HABIT_TARGET_COPY } from '@/lib/copy/habit-targets';
import { cn } from '@/lib/ui/cn';
import type { HabitTargetWeekday } from '@/types/habit-target';

interface HabitTargetWeekdaySelectorProps {
  /** Habit display name, used in the group's accessible label. */
  habitName: string;
  /** Selected weekdays, Sunday-first domain values. */
  selected: readonly HabitTargetWeekday[];
  /** Receives the next canonical selection (sorted, deduplicated). */
  onChange: (weekdays: HabitTargetWeekday[]) => void;
  disabled?: boolean;
}

/**
 * Accessible weekday selector for one habit target.
 *
 * Renders lunes–domingo as seven toggle buttons while keeping the Sunday-first
 * domain values (`0 = Sunday … 6 = Saturday`) intact: the button for Domingo
 * reports value `0`. Buttons are native, so they are keyboard-operable with
 * Space/Enter and each is a 44px tap target; the row wraps instead of
 * overflowing on narrow screens.
 *
 * @param props Habit name, current selection, change handler and disabled flag.
 * @returns A wrapping toggle group for the seven weekdays.
 * @example
 * <HabitTargetWeekdaySelector habitName="Pasos Activos" selected={[1]} onChange={setDays} />
 */
export function HabitTargetWeekdaySelector({
  habitName,
  selected,
  onChange,
  disabled = false,
}: HabitTargetWeekdaySelectorProps): JSX.Element {
  return (
    <div
      role="group"
      aria-label={HABIT_TARGET_COPY.weekdayGroupAria(habitName)}
      className="flex min-w-0 flex-wrap gap-1.5"
    >
      {WEEKDAY_DISPLAY_ORDER.map((weekday) => {
        const active = selected.includes(weekday);

        return (
          <button
            key={weekday}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(toggleWeekday(selected, weekday))}
            className={cn(
              'min-h-11 min-w-11 rounded-lg px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              active
                ? 'bg-brand text-brand-foreground shadow-sm'
                : 'bg-surface text-ink-muted ring-1 ring-line hover:bg-canvas hover:text-ink',
              disabled && 'cursor-not-allowed opacity-70',
            )}
          >
            {HABIT_TARGET_COPY.weekdays[weekday]}
          </button>
        );
      })}
    </div>
  );
}
