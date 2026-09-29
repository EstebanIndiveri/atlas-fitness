import type { JSX } from 'react';

import { formatHabitActivityDate } from '@/components/habits/habit-activity-format';
import { HABIT_TARGET_COPY } from '@/lib/copy/habit-targets';
import { cn } from '@/lib/ui/cn';
import type { HabitKey } from '@/types/habit';
import type { HabitTargetDay } from '@/types/habit-adherence';
import type { HabitTargetDayState } from '@/types/habit-target';

const STATE_MARK_CLASS: Record<HabitTargetDayState, string> = {
  expected_completed: 'bg-brand text-brand-foreground',
  expected_unrecorded: 'bg-brand-muted text-brand ring-1 ring-brand/40',
  extra_recorded: 'bg-canvas text-ink ring-1 ring-line',
  not_expected: 'bg-surface text-ink-muted',
  future_expected: 'bg-surface text-ink-muted opacity-60 ring-1 ring-line',
};

const LEGEND_ORDER: readonly HabitTargetDayState[] = [
  'expected_completed',
  'expected_unrecorded',
  'extra_recorded',
  'not_expected',
  'future_expected',
];

interface HabitTargetDayMarkProps {
  day: HabitTargetDay;
  habitKey: HabitKey;
}

/**
 * One calendar day of one habit, as a mark coloured by its honest state.
 *
 * The weekday initial is `aria-hidden` because initials repeat in es-AR; the
 * mark carries the full date and state as its accessible name, so the five daily
 * states are distinguishable without relying on colour.
 */
function HabitTargetDayMark({ day, habitKey }: HabitTargetDayMarkProps): JSX.Element {
  const state = day.habitStates[habitKey];
  const formattedDate = formatHabitActivityDate(day.localDate);

  return (
    <li
      data-state={state}
      aria-label={HABIT_TARGET_COPY.dayStateLabel(formattedDate, HABIT_TARGET_COPY.dayStates[state])}
      className={cn(
        'grid h-7 w-7 shrink-0 place-items-center rounded-md text-[0.6rem] font-semibold',
        STATE_MARK_CLASS[state],
      )}
    >
      <span aria-hidden>{HABIT_TARGET_COPY.weekdayShort[day.weekday]}</span>
    </li>
  );
}

interface HabitTargetDayStripProps {
  habitName: string;
  habitKey: HabitKey;
  days: readonly HabitTargetDay[];
}

/**
 * One day strip per habit for a resolved window.
 * @param props - Habit identity and the ordered window days.
 * @returns The marks, each labelled with its date and state.
 */
export function HabitTargetDayStrip({
  habitName,
  habitKey,
  days,
}: HabitTargetDayStripProps): JSX.Element {
  return (
    <ul
      aria-label={HABIT_TARGET_COPY.dayStripAria(habitName)}
      className="flex min-w-0 flex-wrap gap-1"
    >
      {days.map((day) => (
        <HabitTargetDayMark key={day.localDate} day={day} habitKey={habitKey} />
      ))}
    </ul>
  );
}

/**
 * What every target-adherence mark means, named as records and objectives rather
 * than as success or failure.
 * @returns The five-state legend line.
 */
export function HabitTargetDayLegend(): JSX.Element {
  return (
    <ul
      aria-label={HABIT_TARGET_COPY.legendTitle}
      className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted"
    >
      {LEGEND_ORDER.map((state) => (
        <li key={state} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn('h-3 w-3 rounded-sm', STATE_MARK_CLASS[state])} />
          {HABIT_TARGET_COPY.dayStates[state]}
        </li>
      ))}
    </ul>
  );
}
