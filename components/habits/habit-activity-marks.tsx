import type { JSX } from 'react';

import {
  formatHabitActivityDate,
  formatHabitActivityWeekday,
} from '@/components/habits/habit-activity-format';
import { HABIT_PREVIEWS } from '@/components/habits/habit-catalog';
import { MetricValue } from '@/components/ui/MetricValue';
import { PROGRESS_COPY } from '@/lib/copy/progress';
import { cn } from '@/lib/ui/cn';
import { metric } from '@/types/metric';
import type { HabitActivityDay, HabitActivityWindow } from '@/types/habit-activity';
import type { HabitKey } from '@/types/habit';

const COPY = PROGRESS_COPY.habitActivity;

const MARK_CLASS =
  'grid h-9 w-9 shrink-0 place-items-center gap-0.5 rounded-lg font-semibold leading-none';
const LEGEND_ITEM_CLASS = 'inline-flex items-center gap-1.5';
const LEGEND_SWATCH_CLASS = 'h-3 w-3 rounded-sm';

interface DayMarkProps {
  day: HabitActivityDay;
  habitKey: HabitKey;
}

/**
 * One day of one habit, as a mark: weekday initial plus day number, coloured by state.
 *
 * The visible glyphs are `aria-hidden` because the initials are not unique in es-AR (`mar` and
 * `mié` both start with `M`); the mark carries the full date and state as its accessible name.
 */
function DayMark({ day, habitKey }: DayMarkProps): JSX.Element {
  const formattedDate = formatHabitActivityDate(day.localDate);
  const recorded = day.recordedKeys.includes(habitKey);
  const label = day.isFuture
    ? COPY.dayFuture(formattedDate)
    : recorded
      ? COPY.dayRecorded(formattedDate)
      : COPY.dayMissing(formattedDate);

  return (
    <li
      aria-label={label}
      className={cn(
        MARK_CLASS,
        day.isFuture
          ? 'bg-surface text-ink-muted opacity-60 ring-1 ring-line'
          : recorded
            ? 'bg-brand text-brand-foreground'
            : 'bg-canvas text-ink-muted ring-1 ring-line',
      )}
    >
      <span aria-hidden className="text-[0.6rem]">
        {formatHabitActivityWeekday(day.localDate)}
      </span>
      <span aria-hidden className="text-[0.7rem] tabular-nums">
        {formattedDate.slice(0, 2)}
      </span>
    </li>
  );
}

interface HabitDayMarksProps {
  habit: (typeof HABIT_PREVIEWS)[number];
  activity: HabitActivityWindow;
}

function HabitDayMarks({ habit, activity }: HabitDayMarksProps): JSX.Element {
  return (
    <ul aria-label={COPY.dayStripAria(habit.name)} className="flex flex-wrap gap-1">
      {activity.days.map((day) => (
        <DayMark key={day.localDate} day={day} habitKey={habit.id} />
      ))}
    </ul>
  );
}

interface HabitStripListProps {
  activity: HabitActivityWindow;
  /**
   * Only an available window states per-habit recorded-day counts. An insufficient one still marks
   * the days themselves, so the reader sees a record that is short rather than an empty screen.
   */
  showRecordedDays: boolean;
}

/**
 * One day strip per catalog habit for a resolved window.
 * @param props - Window plus whether per-habit counts are stated.
 * @returns The strips, each marked with Córdoba weekday initials and day numbers.
 */
export function HabitStripList({ activity, showRecordedDays }: HabitStripListProps): JSX.Element {
  return (
    <div data-testid="habit-activity-strips" className="min-w-0 space-y-4">
      {HABIT_PREVIEWS.map((habit) => (
        <div key={habit.id} className="min-w-0 space-y-2">
          {showRecordedDays && (
            <MetricValue
              metric={metric(
                COPY.recordedDaysLabel(
                  habit.name,
                  activity.perHabit[habit.id].activeDays,
                  activity.elapsedDays,
                ),
                'atlas_computed',
              )}
              showSource
              className="text-sm"
            />
          )}
          <HabitDayMarks habit={habit} activity={activity} />
        </div>
      ))}
    </div>
  );
}

/**
 * What each mark colour means. States are named as records, never as successes or failures.
 * @returns The legend line.
 */
export function StateLegend(): JSX.Element {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
      <span className={LEGEND_ITEM_CLASS}>
        <span aria-hidden className={cn(LEGEND_SWATCH_CLASS, 'bg-brand')} />
        {COPY.legendRecorded}
      </span>
      <span className={LEGEND_ITEM_CLASS}>
        <span aria-hidden className={cn(LEGEND_SWATCH_CLASS, 'bg-canvas ring-1 ring-line')} />
        {COPY.legendMissing}
      </span>
      <span className={LEGEND_ITEM_CLASS}>
        <span aria-hidden className={cn(LEGEND_SWATCH_CLASS, 'bg-surface opacity-60 ring-1 ring-line')} />
        {COPY.legendFuture}
      </span>
    </p>
  );
}

/**
 * Córdoba local date of the current day inside the window.
 *
 * The `week` window ends on the upcoming Sunday, so `windowEnd` can be a future date and is not a
 * safe stand-in here: the caption would claim that a day which has not happened yet is today. The
 * service flags exactly one day as `isToday`; window end is only used as a fallback when that day
 * has already arrived.
 *
 * @returns Córdoba `YYYY-MM-DD` date, or `null` when the window carries no day that has arrived.
 */
export function resolveWindowToday(activity: HabitActivityWindow): string | null {
  const flagged = activity.days.find((day) => day.isToday);

  if (flagged !== undefined) {
    return flagged.localDate;
  }

  const lastDay = activity.days[activity.days.length - 1];

  return lastDay !== undefined && !lastDay.isFuture ? lastDay.localDate : null;
}

interface WindowCaptionProps {
  activity: HabitActivityWindow;
}

/**
 * The exact window a record covers, in Córdoba time, with the day that has actually arrived.
 * @param props - Resolved window.
 * @returns The caption line.
 */
export function WindowCaption({ activity }: WindowCaptionProps): JSX.Element {
  const today = resolveWindowToday(activity);

  return (
    <p className="text-xs leading-relaxed text-ink-muted">
      <span>
        {COPY.windowLabel(
          formatHabitActivityDate(activity.windowStart),
          formatHabitActivityDate(activity.windowEnd),
        )}
      </span>
      {today !== null && (
        <>
          {' · '}
          <span>{COPY.todayIsLabel(formatHabitActivityDate(today))}</span>
        </>
      )}
    </p>
  );
}
