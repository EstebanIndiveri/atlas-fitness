'use client';

import type { JSX } from 'react';
import { useState } from 'react';

import { formatWeekdayList } from '@/components/habits/habit-target-format';
import { HabitTargetTodayBadge } from '@/components/habits/HabitTargetTodayBadge';
import { HabitTargetWeekdaySelector } from '@/components/habits/HabitTargetWeekdaySelector';
import type { HabitPreview } from '@/components/habits/habit-catalog';
import { cn } from '@/lib/ui/cn';
import { HABIT_TARGET_COPY } from '@/lib/copy/habit-targets';
import type { HabitTargetResponse } from '@/lib/api/habit-targets';
import type { HabitTargetWeekday } from '@/types/habit-target';

interface HabitTargetRowProps {
  habit: HabitPreview;
  /** Active target, or `null` when the habit is not configured. */
  target: HabitTargetResponse | null;
  /** Draft selection owned by the section, in Sunday-first domain values. */
  selected: readonly HabitTargetWeekday[];
  expectedToday: boolean;
  saving: boolean;
  onSelect: (weekdays: HabitTargetWeekday[]) => void;
  onSave: () => void;
  onDeactivate: () => void;
}

/**
 * Configuration row for one fixed habit: its current target, the accessible
 * weekday selector, an explicit save, and a confirmed deactivation.
 *
 * Deactivation requires a second, explicit confirmation because it ends the
 * current target; the copy states that earlier activity is preserved. Saving is
 * blocked while no weekday is selected so a zero-day schedule can never be sent.
 *
 * @param props Habit, current target, draft selection and handlers.
 * @returns One `li` of the `Mis días objetivo` list.
 * @example
 * <HabitTargetRow habit={habit} target={null} selected={[]} expectedToday={false} saving={false} onSelect={set} onSave={save} onDeactivate={off} />
 */
export function HabitTargetRow({
  habit,
  target,
  selected,
  expectedToday,
  saving,
  onSelect,
  onSave,
  onDeactivate,
}: HabitTargetRowProps): JSX.Element {
  const [confirming, setConfirming] = useState(false);

  const hasSelection = selected.length > 0;
  const canSave = hasSelection && !saving;
  const showConfirmation = confirming && target !== null;

  return (
    <li data-testid={`habit-target-row-${habit.id}`} className="min-w-0 space-y-3 py-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h3 className="min-w-0 text-sm font-semibold text-ink">{habit.name}</h3>
        {expectedToday ? <HabitTargetTodayBadge habitKey={habit.id} /> : null}
        {target !== null ? (
          <span className="text-xs text-ink-muted">
            {HABIT_TARGET_COPY.configuredSummary(formatWeekdayList(target.weekdays))}
          </span>
        ) : null}
      </div>

      <HabitTargetWeekdaySelector
        habitName={habit.name}
        selected={selected}
        onChange={onSelect}
        disabled={saving}
      />

      {!hasSelection ? (
        <p className="text-xs text-ink-muted">{HABIT_TARGET_COPY.noDaysSelected}</p>
      ) : null}

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={onSave}
          className={cn(
            'min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
            canSave ? 'hover:bg-brand-hover' : 'cursor-not-allowed opacity-70',
          )}
        >
          {HABIT_TARGET_COPY.save}
        </button>

        {target !== null ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => setConfirming(true)}
            className={cn(
              'min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              saving ? 'cursor-not-allowed opacity-70' : 'hover:bg-canvas',
            )}
          >
            {HABIT_TARGET_COPY.deactivate}
          </button>
        ) : null}
      </div>

      {showConfirmation ? (
        <div className="space-y-2 rounded-xl bg-canvas p-3" role="group" aria-label={HABIT_TARGET_COPY.confirmDeactivateTitle}>
          <p className="text-sm font-semibold text-ink">{HABIT_TARGET_COPY.confirmDeactivateTitle}</p>
          <p className="text-xs leading-relaxed text-ink-muted">
            {HABIT_TARGET_COPY.confirmDeactivateBody}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setConfirming(false);
                onDeactivate();
              }}
              className="min-h-11 rounded-lg bg-danger px-4 text-sm font-semibold text-danger-foreground transition hover:bg-danger/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
            >
              {HABIT_TARGET_COPY.confirmDeactivate}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirming(false)}
              className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {HABIT_TARGET_COPY.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
